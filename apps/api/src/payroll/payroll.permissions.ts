export const PAYROLL_PERMISSIONS = {
  READ: 'payroll:read',
  CREATE: 'payroll:create',
  CALCULATE: 'payroll:calculate',
  UPDATE_INPUTS: 'payroll:update-inputs',
  DELETE_DRAFT: 'payroll:delete-draft',

  RUN_AUDIT: 'payroll:run-audit',
  VIEW_FINDINGS: 'payroll:view-findings',
  RESOLVE_FINDINGS: 'payroll:resolve-findings',

  HR_REVIEW: 'payroll:hr-review',
  FINANCE_REVIEW: 'payroll:finance-review',
  SUBMIT: 'payroll:submit',
  APPROVE: 'payroll:approve',
  REJECT: 'payroll:reject',
  FINALISE: 'payroll:finalise',
  REOPEN: 'payroll:reopen',

  VIEW_REPORTS: 'payroll:view-reports',
  EXPORT: 'payroll:export',
  VIEW_BANK_DETAILS: 'payroll:view-bank-details',
  EXPORT_BANK_FILE: 'payroll:export-bank-file',

  COMPENSATION_READ: 'compensation:read',
  COMPENSATION_CREATE: 'compensation:create',
  COMPENSATION_UPDATE: 'compensation:update',
  COMPENSATION_VIEW_SENSITIVE: 'compensation:view-sensitive',

  PAYSLIPS_VIEW_OWN: 'payslips:view-own',
  PAYSLIPS_VIEW_ALL: 'payslips:view-all',
  PAYSLIPS_GENERATE: 'payslips:generate',
} as const;
