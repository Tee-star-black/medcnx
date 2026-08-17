import {
  Injectable,
} from '@nestjs/common';

import {
  PayrollAuditRiskLevel,
  PayrollAuditSeverity,
} from '@prisma/client';

import {
  PayrollAuditRuleFinding,
} from './interfaces/payroll-audit-rule.interface';

export interface PayrollHealthScoreResult {
  healthScore: number;
  riskLevel: PayrollAuditRiskLevel;
  blocked: boolean;

  criticalCount: number;
  highCount: number;
  warningCount: number;
  infoCount: number;
}

@Injectable()
export class PayrollHealthScoreService {
  calculate(
    findings: PayrollAuditRuleFinding[],
  ): PayrollHealthScoreResult {
    const criticalCount = findings.filter(
      (finding) =>
        finding.severity ===
        PayrollAuditSeverity.CRITICAL,
    ).length;

    const highCount = findings.filter(
      (finding) =>
        finding.severity ===
        PayrollAuditSeverity.HIGH,
    ).length;

    const warningCount = findings.filter(
      (finding) =>
        finding.severity ===
        PayrollAuditSeverity.WARNING,
    ).length;

    const infoCount = findings.filter(
      (finding) =>
        finding.severity ===
        PayrollAuditSeverity.INFO,
    ).length;

    const deduction =
      criticalCount * 25 +
      highCount * 12 +
      warningCount * 5 +
      infoCount * 1;

    const healthScore = Math.max(
      0,
      Math.min(100, 100 - deduction),
    );

    const blocked = criticalCount > 0;

    let riskLevel: PayrollAuditRiskLevel;

    if (criticalCount > 0 || healthScore < 40) {
      riskLevel =
        PayrollAuditRiskLevel.CRITICAL;
    } else if (
      highCount > 0 ||
      healthScore < 65
    ) {
      riskLevel = PayrollAuditRiskLevel.HIGH;
    } else if (
      warningCount > 0 ||
      healthScore < 85
    ) {
      riskLevel =
        PayrollAuditRiskLevel.MEDIUM;
    } else {
      riskLevel = PayrollAuditRiskLevel.LOW;
    }

    return {
      healthScore,
      riskLevel,
      blocked,
      criticalCount,
      highCount,
      warningCount,
      infoCount,
    };
  }
}
