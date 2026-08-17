import {
  canTransition,
  duplicateFingerprint,
  formatDocumentDate,
  formatZar,
  getMissingFields,
  isEmployeeVisible,
} from './document-rules';

describe('Document Generation V2 rules', () => {
  it('formats South African dates and Rand values', () => {
    expect(formatDocumentDate(new Date('2026-07-21T00:00:00Z'))).toContain(
      '2026',
    );
    expect(formatZar(12500)).toMatch(/12[\s,]500[.,]00/);
  });
  it('reports required mapped fields without treating protected assets as text', () => {
    expect(
      getMissingFields(
        ['employee.fullName', 'employee.email', 'organisation.logo'],
        {
          employee: { fullName: 'Tee', email: '' },
          organisation: { logo: '' },
        },
        ['organisation.logo'],
      ),
    ).toEqual(['employee.email', 'organisation.logo']);
  });
  it('enforces final status transitions', () => {
    expect(canTransition('PENDING_CEO_APPROVAL', 'SIGNED')).toBe(true);
    expect(canTransition('REJECTED', 'PUBLISHED')).toBe(false);
    expect(canTransition('PUBLISHED', 'DRAFT')).toBe(false);
  });
  it('only exposes published, enabled and non-withdrawn documents', () => {
    expect(
      isEmployeeVisible({ status: 'PUBLISHED', visibleToEmployee: true }),
    ).toBe(true);
    expect(
      isEmployeeVisible({
        status: 'PENDING_CEO_APPROVAL',
        visibleToEmployee: true,
      }),
    ).toBe(false);
    expect(
      isEmployeeVisible({
        status: 'PUBLISHED',
        visibleToEmployee: true,
        withdrawnAt: new Date(),
      }),
    ).toBe(false);
  });
  it('creates stable duplicate fingerprints', () => {
    expect(duplicateFingerprint('t1', 'e1', '2026-08-01', ' Offer ')).toBe(
      duplicateFingerprint('t1', 'e1', '2026-08-01', 'offer'),
    );
    expect(duplicateFingerprint('t1', 'e1')).not.toBe(
      duplicateFingerprint('t1', 'e2'),
    );
  });
});
