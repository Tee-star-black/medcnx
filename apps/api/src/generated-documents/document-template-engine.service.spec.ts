import PizZip from 'pizzip';
import { BadRequestException } from '@nestjs/common';
import { DocumentTemplateEngineService } from './document-template-engine.service';
function docxXml(text: string) {
  const zip = new PizZip();
  zip.file(
    'word/document.xml',
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`,
  );
  return zip.generate({ type: 'nodebuffer' });
}
describe('DocumentTemplateEngineService', () => {
  const service = new DocumentTemplateEngineService();
  it('detects and validates supported placeholders', () => {
    expect(
      service.detect(
        docxXml('{{employee.fullName}} {{document.generatedDate}}'),
      ),
    ).toEqual(
      expect.objectContaining({
        detectedPlaceholders: ['document.generatedDate', 'employee.fullName'],
        unsupportedPlaceholders: [],
        isValid: true,
      }),
    );
  });
  it('identifies unsupported placeholders', () => {
    const result = service.detect(docxXml('{{employee.hpcsaNumber}}'));
    expect(result.isValid).toBe(false);
    expect(result.unsupportedPlaceholders).toEqual(['employee.hpcsaNumber']);
  });
  it('rejects invalid DOCX bytes', () => {
    expect(() => service.detect(Buffer.from('not a zip'))).toThrow(
      BadRequestException,
    );
  });
});
