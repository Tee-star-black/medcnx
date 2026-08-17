import {
  Employee,
  EmployeeCompensationProfile,
  PayrollRun,
  PayrollRunItem,
} from '@prisma/client';

export type PayrollAuditEmployee = Employee & {
  compensationProfile: EmployeeCompensationProfile | null;
};

export type PayrollAuditRunItem = PayrollRunItem & {
  employee: PayrollAuditEmployee;
};

export interface PayrollAuditContext {
  organisationId: string;

  payrollRun: PayrollRun & {
    items: PayrollAuditRunItem[];
  };

  previousPayrollRun:
    | (PayrollRun & {
        items: PayrollRunItem[];
      })
    | null;

  generatedAt: Date;
}
