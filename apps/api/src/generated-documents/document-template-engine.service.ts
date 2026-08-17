import { BadRequestException, Injectable } from '@nestjs/common';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';

const LOGO_SENTINEL = '__MEDCNX_PRIVATE_LOGO__';
const SIGNATURE_SENTINEL = '__MEDCNX_PRIVATE_SIGNATURE__';
export const SUPPORTED_PLACEHOLDERS = [
  'employee.fullName',
  'employee.firstName',
  'employee.lastName',
  'employee.employeeNumber',
  'employee.email',
  'employee.phone',
  'employee.jobTitle',
  'employee.department',
  'employee.startDate',
  'employee.employmentStatus',
  'employee.basicSalary',
  'employee.address',
  'employee.idNumber',
  'organisation.name',
  'organisation.address',
  'organisation.email',
  'organisation.phone',
  'organisation.registrationNumber',
  'organisation.logo',
  'document.title',
  'document.referenceNumber',
  'document.generatedDate',
  'document.effectiveDate',
  'document.positionTitle',
  'document.commencementDate',
  'document.reportingLine',
  'document.natureOfEmployment',
  'document.hoursOfWork',
  'document.remunerationPackage',
  'document.regulatoryCompliance',
  'document.expiryDate',
  'document.addresseeName',
  'document.addresseeAddress',
  'document.professionalRegistrationNumber',
  'document.remunerationInWords',
  'document.payeReferenceNumber',
  'document.payPeriod',
  'document.bankAccountMasked',
  'document.bankName',
  'document.allowancesDetails',
  'document.contractType',
  'document.employmentSchedule',
  'document.endDate',
  'document.probationPeriod',
  'document.workLocation',
  'document.noticePeriod',
  'document.professionalCouncil',
  'document.specialConditions',
  'document.confirmationPurpose',
  'document.leaveType',
  'document.leaveStartDate',
  'document.leaveEndDate',
  'document.leaveDays',
  'document.incidentDate',
  'document.incidentDescription',
  'document.hearingDate',
  'document.hearingLocation',
  'document.chairperson',
  'document.warningLevel',
  'document.warningExpiryDate',
  'document.requiredImprovement',
  'document.disciplinaryOutcome',
  'document.terminationDate',
  'ceo.fullName',
  'ceo.jobTitle',
  'ceo.signature',
] as const;

@Injectable()
export class DocumentTemplateEngineService {
  detect(bytes: Buffer) {
    let zip: PizZip;
    try {
      zip = new PizZip(bytes);
    } catch {
      throw new BadRequestException(
        'The uploaded file is not a valid DOCX document.',
      );
    }
    const found = new Set<string>();
    for (const name of Object.keys(zip.files).filter((x) =>
      /^word\/(document|header\d+|footer\d+)\.xml$/.test(x),
    )) {
      const text = (zip.file(name)?.asText() ?? '').replace(/<[^>]+>/g, '');
      for (const match of text.matchAll(/\{\{%?\s*([a-zA-Z0-9_.-]+)\s*\}\}/g))
        found.add(match[1]);
    }
    const detectedPlaceholders = [...found].sort(),
      supported = new Set<string>(SUPPORTED_PLACEHOLDERS),
      unsupportedPlaceholders = detectedPlaceholders.filter(
        (x) => !supported.has(x),
      );
    return {
      detectedPlaceholders,
      unsupportedPlaceholders,
      isValid:
        detectedPlaceholders.length > 0 && !unsupportedPlaceholders.length,
      validationErrors: [
        ...(detectedPlaceholders.length
          ? []
          : ['No {{placeholder}} values were detected.']),
        ...unsupportedPlaceholders.map(
          (x) => `Unsupported placeholder: {{${x}}}`,
        ),
      ],
    };
  }
  render(
    bytes: Buffer,
    data: Record<string, unknown>,
    images?: { logo?: Buffer; signature?: Buffer },
  ) {
    try {
      const zip = new PizZip(bytes);
      for (const name of Object.keys(zip.files).filter((x) =>
        /^word\/(document|header\d+|footer\d+)\.xml$/.test(x),
      )) {
        const file = zip.file(name);
        if (!file) continue;
        let xml = file.asText();
        for (const p of SUPPORTED_PLACEHOLDERS)
          xml = xml.replaceAll(`{{${p}}}`, `{${p}}`);
        zip.file(name, xml);
      }
      const employee = data.employee as Record<string, unknown>,
        organisation = data.organisation as Record<string, unknown>,
        document = data.document as Record<string, unknown>,
        ceo = data.ceo as Record<string, unknown>;
      const flat = Object.fromEntries(
        Object.entries({ employee, organisation, document, ceo }).flatMap(
          ([scope, values]) =>
            Object.entries(values ?? {}).map(([key, value]) => [
              `${scope}.${key}`,
              value,
            ]),
        ),
      );
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => '',
      });
      doc.render({
        ...data,
        ...flat,
        'organisation.logo': images?.logo?.length ? LOGO_SENTINEL : '',
        'ceo.signature': images?.signature?.length ? SIGNATURE_SENTINEL : '',
        employee,
        organisation: {
          ...organisation,
          logo: images?.logo?.length ? LOGO_SENTINEL : '',
        },
        ceo: {
          ...ceo,
          signature: images?.signature?.length ? SIGNATURE_SENTINEL : '',
        },
      });
      const rendered = doc.getZip();
      if (images?.logo?.length)
        this.insertImage(
          rendered,
          LOGO_SENTINEL,
          images.logo,
          'medcnx-logo',
          190,
          70,
        );
      if (images?.signature?.length)
        this.insertImage(
          rendered,
          SIGNATURE_SENTINEL,
          images.signature,
          'medcnx-signature',
          170,
          65,
        );
      return rendered.generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      }) as Buffer;
    } catch (error) {
      throw new BadRequestException(
        `DOCX template rendering failed: ${error instanceof Error ? error.message : 'Template rendering failed.'}`,
      );
    }
  }
  private insertImage(
    zip: PizZip,
    sentinel: string,
    bytes: Buffer,
    assetName: string,
    widthPx: number,
    heightPx: number,
  ) {
    const ext = bytes[0] === 0xff && bytes[1] === 0xd8 ? 'jpg' : 'png';
    zip.file(`word/media/${assetName}.${ext}`, bytes);
    for (const part of Object.keys(zip.files).filter((x) =>
      /^word\/(document|header\d+|footer\d+)\.xml$/.test(x),
    )) {
      const file = zip.file(part);
      if (!file) continue;
      let xml = file.asText();
      if (!xml.includes(sentinel)) continue;
      const base = part.split('/').pop()!,
        relPath = `word/_rels/${base}.rels`,
        rid = `rId-${assetName}`;
      let rels =
        zip.file(relPath)?.asText() ??
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
      if (!rels.includes(`Id="${rid}"`))
        rels = rels.replace(
          '</Relationships>',
          `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${assetName}.${ext}"/></Relationships>`,
        );
      zip.file(relPath, rels);
      const cx = widthPx * 9525,
        cy = heightPx * 9525,
        drawing = `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="1" name="${assetName}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="${assetName}.${ext}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`;
      xml = xml
        .replaceAll(`<w:t>${sentinel}</w:t>`, drawing)
        .replaceAll(`<w:t xml:space="preserve">${sentinel}</w:t>`, drawing);
      zip.file(part, xml);
    }
    const ct = zip.file('[Content_Types].xml');
    if (ct) {
      let xml = ct.asText();
      if (!xml.includes(`Extension="${ext}"`)) {
        xml = xml.replace(
          '</Types>',
          `<Default Extension="${ext}" ContentType="${ext === 'png' ? 'image/png' : 'image/jpeg'}"/></Types>`,
        );
        zip.file('[Content_Types].xml', xml);
      }
    }
  }
}
