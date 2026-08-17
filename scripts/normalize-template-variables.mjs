import fs from "node:fs";
import path from "node:path";
import PizZip from "pizzip";

const root = "apps/api/resources/document-templates";
const replacements = new Map([
  ["[Insert Registration Number]", "{{organisation.registrationNumber}}"],
  ["[Candidate Mobile Number]", "{{employee.phone}}"],
  [
    "[Insert Expiry Date, e.g., 5 business days from today]",
    "{{document.expiryDate}}",
  ],
  ["[Insert Name of HR Manager / CEO]", "{{ceo.fullName}}"],
  ["[Insert Name of Authorized Signatory]", "{{ceo.fullName}}"],
  ["[Insert Title]", "{{ceo.jobTitle}}"],
  [
    "[Insert Title, e.g., Human Resources Manager / Payroll Administrator]",
    "{{ceo.jobTitle}}",
  ],
  [
    "[Insert Position Title, e.g., Medical Practitioner / Clinical Nurse / Receptionist]",
    "{{document.positionTitle}}",
  ],
  [
    "[Insert Position Title, e.g., Medical Practitioner / Clinical Nurse / Medical Receptionist]",
    "{{document.positionTitle}}",
  ],
  [
    "[Insert Financial Institution / Requesting Entity Name]",
    "{{document.addresseeName}}",
  ],
  [
    "[Insert Address / Branch Name - Optional]",
    "{{document.addresseeAddress}}",
  ],
  ["[Insert Company HR Phone Number]", "{{organisation.phone}}"],
  ["[Insert HPCSA ClinA No.]", "{{document.professionalRegistrationNumber}}"],
  ["[Insert HPCSA No.]", "{{document.professionalRegistrationNumber}}"],
  ["[Insert Amount in Words]", "{{document.remunerationInWords}}"],
]);

for (const fileName of fs
  .readdirSync(root)
  .filter((name) => name.toLowerCase().endsWith(".docx"))) {
  const filePath = path.join(root, fileName);
  const zip = new PizZip(fs.readFileSync(filePath));
  let changed = false;
  for (const part of Object.keys(zip.files).filter((name) =>
    /^word\/(document|header\d+|footer\d+)\.xml$/.test(name),
  )) {
    let xml = zip.file(part)?.asText() ?? "";
    const original = xml;
    for (const [from, to] of replacements) xml = xml.replaceAll(from, to);
    if (xml !== original) {
      zip.file(part, xml);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(
      filePath,
      zip.generate({ type: "nodebuffer", compression: "DEFLATE" }),
    );
    console.log(filePath);
  }
}
