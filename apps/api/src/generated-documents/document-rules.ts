import { GeneratedDocumentStatus } from '@prisma/client';

const TRANSITIONS: Record<GeneratedDocumentStatus, GeneratedDocumentStatus[]> =
  {
    DRAFT: ['GENERATED_FOR_REVIEW', 'CANCELLED', 'FAILED'],
    GENERATED_FOR_REVIEW: [
      'PENDING_CEO_APPROVAL',
      'PUBLISHED',
      'CANCELLED',
      'FAILED',
    ],
    PENDING_CEO_APPROVAL: [
      'APPROVED',
      'SIGNED',
      'REJECTED',
      'CANCELLED',
      'FAILED',
    ],
    APPROVED: ['SIGNED', 'PUBLISHED', 'FAILED'],
    SIGNED: ['PUBLISHED', 'FAILED'],
    PUBLISHED: [],
    REJECTED: [],
    CANCELLED: [],
    FAILED: ['DRAFT'],
  };
export function formatDocumentDate(value?: Date | null) {
  return value
    ? new Intl.DateTimeFormat('en-ZA', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }).format(value)
    : '';
}
export function formatZar(value?: { toString(): string } | number | null) {
  if (value === null || value === undefined) return '';
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(Number(value));
}
export function getMissingFields(
  placeholders: string[],
  data: Record<string, unknown>,
  assetMissing: string[] = [],
) {
  const value = (path: string) =>
    path
      .split('.')
      .reduce<unknown>(
        (v, k) =>
          v && typeof v === 'object'
            ? (v as Record<string, unknown>)[k]
            : undefined,
        data,
      );
  return [
    ...new Set([
      ...placeholders.filter(
        (p) =>
          !value(p) &&
          ![
            'organisation.logo',
            'ceo.signature',
            'document.referenceNumber',
          ].includes(p),
      ),
      ...assetMissing,
    ]),
  ];
}
export function canTransition(
  from: GeneratedDocumentStatus,
  to: GeneratedDocumentStatus,
) {
  return TRANSITIONS[from].includes(to);
}
export function isEmployeeVisible(document: {
  status: GeneratedDocumentStatus;
  visibleToEmployee: boolean;
  withdrawnAt?: Date | null;
}) {
  return (
    document.status === 'PUBLISHED' &&
    document.visibleToEmployee &&
    !document.withdrawnAt
  );
}
export function duplicateFingerprint(
  templateId: string,
  employeeId: string,
  effectiveDate?: string,
  title?: string,
) {
  return [
    templateId,
    employeeId,
    effectiveDate || '',
    title?.trim().toLowerCase() || '',
  ].join(':');
}
