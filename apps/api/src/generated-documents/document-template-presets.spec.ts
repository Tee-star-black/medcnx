import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { DocumentTemplateEngineService } from './document-template-engine.service';

describe('Document template preset library', () => {
  const engine = new DocumentTemplateEngineService();
  const root = resolve(__dirname, '../../resources/document-templates');
  const files = readdirSync(root).filter((name) => name.endsWith('.docx'));

  it.each(files)('%s contains only supported variables', (fileName) => {
    const result = engine.detect(readFileSync(resolve(root, fileName)));
    expect(result.detectedPlaceholders.length).toBeGreaterThan(0);
    expect(result.unsupportedPlaceholders).toEqual([]);
    expect(result.isValid).toBe(true);
  });

  it('provides one configurable master employment contract', () => {
    const result = engine.detect(
      readFileSync(resolve(root, 'MedCNX_Employment_Contract_Master.docx')),
    );
    expect(result.detectedPlaceholders).toEqual(
      expect.arrayContaining([
        'document.contractType',
        'document.employmentSchedule',
        'document.endDate',
        'document.probationPeriod',
        'document.workLocation',
        'document.noticePeriod',
        'document.professionalCouncil',
        'document.specialConditions',
        'ceo.signature',
      ]),
    );
  });
});
