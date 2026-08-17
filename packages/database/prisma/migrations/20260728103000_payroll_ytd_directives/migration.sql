ALTER TABLE "employee_compensation_profiles"
ADD COLUMN "taxDirectiveMode" TEXT NOT NULL DEFAULT 'NONE',
ADD COLUMN "taxDirectiveReference" TEXT,
ADD COLUMN "taxDirectiveValue" DECIMAL(8, 2),
ADD COLUMN "taxDirectiveValidFrom" TIMESTAMP(3),
ADD COLUMN "taxDirectiveValidTo" TIMESTAMP(3);

ALTER TABLE "payroll_run_items"
ADD COLUMN "payeRegularTaxableIncome" DECIMAL(12, 2),
ADD COLUMN "payeRegularTaxableIncomeYtd" DECIMAL(12, 2),
ADD COLUMN "payeAnnualPaymentsYtd" DECIMAL(12, 2),
ADD COLUMN "payeYtdBeforeCurrent" DECIMAL(12, 2),
ADD COLUMN "payeCumulativeLiability" DECIMAL(12, 2),
ADD COLUMN "payeAnnualPaymentTax" DECIMAL(12, 2),
ADD COLUMN "payePeriodsWorked" INTEGER,
ADD COLUMN "allowableRetirementDeduction" DECIMAL(12, 2);
