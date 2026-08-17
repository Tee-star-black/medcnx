import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PayrollApprovalStatus,
  PayrollApprovalType,
  PayrollAuditFindingStatus,
  PayrollAuditSeverity,
  PayrollRunStatus,
  UserStatus,
} from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../../mail/mail.service';

type ApprovalEmailInput = {
  approverName: string;
  organisationName: string;
  payrollTitle: string;
  periodMonth: number;
  periodYear: number;
  employeeCount: number;
  grossPay: string;
  deductions: string;
  netPay: string;
  healthScore: number;
  riskLevel: string;
  requestedByName: string;
  requestNote: string;
  approvalUrl: string;
};

@Injectable()
export class PayrollApprovalPreparationService {
  private readonly logger = new Logger(PayrollApprovalPreparationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async listCeoApprovers(
    organisationId: string,
    requestedByUserId?: string,
  ) {
    const users = await this.prisma.user.findMany({
      where: {
        organisationId,
        status: UserStatus.ACTIVE,
        id: requestedByUserId
          ? {
              not: requestedByUserId,
            }
          : undefined,
        userRoles: {
          some: {
            role: {
              rolePermissions: {
                some: {
                  permission: {
                    key: 'payroll:approve',
                  },
                },
              },
            },
          },
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        userRoles: {
          select: {
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.userRoles.map((userRole) => userRole.role.name),
    }));
  }

  async prepareCeoApproval(
    organisationId: string,
    payrollRunId: string,
    requestedByUserId: string,
    approverUserId: string,
    requestNote?: string,
  ) {
    const payrollRun = await this.prisma.payrollRun.findFirst({
      where: {
        id: payrollRunId,
        organisationId,
      },

      include: {
        audit: {
          include: {
            findings: {
              where: {
                status: {
                  not: PayrollAuditFindingStatus.RESOLVED,
                },
              },

              select: {
                id: true,
                ruleCode: true,
                severity: true,
                status: true,
                title: true,
                description: true,
                employeeId: true,
              },

              orderBy: [
                {
                  severity: 'desc',
                },
                {
                  createdAt: 'asc',
                },
              ],
            },
          },
        },

        items: {
          include: {
            employee: {
              select: {
                id: true,
                employeeNumber: true,
                firstName: true,
                lastName: true,
              },
            },
          },

          orderBy: {
            employee: {
              lastName: 'asc',
            },
          },
        },

        organisation: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!payrollRun) {
      throw new NotFoundException('Payroll run not found.');
    }

    if (payrollRun.status !== PayrollRunStatus.FINANCE_REVIEWED) {
      throw new BadRequestException(
        'Payroll must complete finance review before CEO approval can be prepared.',
      );
    }

    if (!payrollRun.audit) {
      throw new BadRequestException(
        'Payroll intelligence audit must be completed before CEO approval.',
      );
    }

    const payrollAudit = payrollRun.audit;

    if (payrollAudit.blocked) {
      throw new BadRequestException(
        'Payroll is blocked by unresolved critical findings.',
      );
    }

    const unresolvedCriticalFindings = payrollAudit.findings.filter(
      (finding) => finding.severity === PayrollAuditSeverity.CRITICAL,
    );

    if (unresolvedCriticalFindings.length > 0) {
      throw new BadRequestException(
        'All critical payroll findings must be resolved before CEO approval.',
      );
    }

    const existingPendingApproval = await this.prisma.payrollApproval.findFirst(
      {
        where: {
          organisationId,
          payrollRunId,

          approvalType: PayrollApprovalType.CEO_APPROVAL,

          status: PayrollApprovalStatus.PENDING,
        },
      },
    );

    if (existingPendingApproval) {
      throw new BadRequestException(
        'A pending CEO approval request already exists for this payroll run.',
      );
    }

    if (approverUserId === requestedByUserId) {
      throw new BadRequestException(
        'The user submitting payroll cannot also provide the final CEO approval.',
      );
    }

    const approver = await this.prisma.user.findFirst({
      where: {
        id: approverUserId,
        organisationId,
      },

      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        userRoles: {
          select: {
            role: {
              select: {
                rolePermissions: {
                  where: {
                    permission: {
                      key: 'payroll:approve',
                    },
                  },
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });

    if (!approver) {
      throw new BadRequestException(
        'The selected CEO approver was not found in this organisation.',
      );
    }

    if (!approver.email) {
      throw new BadRequestException(
        'The selected CEO approver does not have an email address.',
      );
    }

    if (approver.status !== UserStatus.ACTIVE) {
      throw new BadRequestException(
        'The selected CEO approver must have an active user account.',
      );
    }

    const mayApprovePayroll = approver.userRoles.some(
      (userRole) => userRole.role.rolePermissions.length > 0,
    );

    if (!mayApprovePayroll) {
      throw new BadRequestException(
        'The selected CEO approver does not have payroll approval permission.',
      );
    }

    const requestedBy = await this.prisma.user.findFirst({
      where: {
        id: requestedByUserId,
        organisationId,
      },

      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    if (!requestedBy) {
      throw new BadRequestException(
        'The user requesting CEO approval was not found.',
      );
    }

    const summarySnapshot = {
      payrollRunId: payrollRun.id,
      title: payrollRun.title,

      periodMonth: payrollRun.periodMonth,

      periodYear: payrollRun.periodYear,

      employeeCount: payrollRun.employeeCount,

      totalBasicSalary: payrollRun.totalBasicSalary.toFixed(2),

      totalGrossPay: payrollRun.totalGrossPay.toFixed(2),

      totalDeductions: payrollRun.totalDeductions.toFixed(2),

      totalNetPay: payrollRun.totalNetPay.toFixed(2),

      totalPaye: payrollRun.totalPaye.toFixed(2),

      totalUifEmployee: payrollRun.totalUifEmployee.toFixed(2),

      totalEmployerContributions:
        payrollRun.totalEmployerContributions.toFixed(2),

      payrollHealthScore: payrollAudit.healthScore,

      payrollRiskLevel: payrollAudit.riskLevel,

      criticalCount: payrollAudit.criticalCount,

      highCount: payrollAudit.highCount,

      warningCount: payrollAudit.warningCount,

      infoCount: payrollAudit.infoCount,

      blocked: payrollAudit.blocked,

      unresolvedFindings: payrollAudit.findings.map((finding) => ({
        id: finding.id,
        ruleCode: finding.ruleCode,
        severity: finding.severity,
        status: finding.status,
        title: finding.title,
        description: finding.description,
        employeeId: finding.employeeId,
      })),

      employees: payrollRun.items.map((item) => ({
        employeeId: item.employeeId,

        employeeNumber: item.employee.employeeNumber,

        employeeName: `${item.employee.firstName} ${item.employee.lastName}`,

        grossPay: item.grossPay.toFixed(2),

        deductions: item.totalDeductions.toFixed(2),

        netPay: item.netPay.toFixed(2),
      })),

      preparedAt: new Date().toISOString(),
    };

    const approval = await this.prisma.$transaction(async (transaction) => {
      const createdApproval = await transaction.payrollApproval.create({
        data: {
          organisationId,
          payrollRunId,

          approvalType: PayrollApprovalType.CEO_APPROVAL,

          status: PayrollApprovalStatus.PENDING,

          requestedByUserId,
          approverUserId,

          requestNote: requestNote ?? 'Payroll submitted for CEO approval.',

          summarySnapshot,

          metadata: {
            sourceStatus: payrollRun.status,

            requiresOtp: true,

            approvalChannel: 'MEDCNX_SECURE_PORTAL',

            notificationChannel: 'EMAIL',
          },
        },
      });

      await transaction.payrollRun.update({
        where: {
          id: payrollRunId,
        },

        data: {
          status: PayrollRunStatus.PENDING_CEO_APPROVAL,
        },
      });

      await transaction.payrollTimelineEvent.create({
        data: {
          organisationId,
          payrollRunId,

          actorUserId: requestedByUserId,

          eventType: 'PAYROLL_CEO_APPROVAL_REQUESTED',

          title: 'CEO approval requested',

          message: requestNote ?? 'Payroll was submitted for CEO approval.',

          metadata: {
            approvalId: createdApproval.id,

            approverUserId,

            approverEmail: approver.email,

            healthScore: payrollAudit.healthScore,

            riskLevel: payrollAudit.riskLevel,

            totalGrossPay: payrollRun.totalGrossPay.toFixed(2),

            totalDeductions: payrollRun.totalDeductions.toFixed(2),

            totalNetPay: payrollRun.totalNetPay.toFixed(2),

            employeeCount: payrollRun.employeeCount,

            requiresOtp: true,
          },
        },
      });

      return createdApproval;
    });

    const recipient = this.getNotificationRecipient(approver.email);

    const approvalUrl = this.getApprovalUrl(payrollRun.id);

    const emailInput: ApprovalEmailInput = {
      approverName: `${approver.firstName} ${approver.lastName}`,

      organisationName: payrollRun.organisation.name,

      payrollTitle: payrollRun.title,

      periodMonth: payrollRun.periodMonth,

      periodYear: payrollRun.periodYear,

      employeeCount: payrollRun.employeeCount,

      grossPay: payrollRun.totalGrossPay.toFixed(2),

      deductions: payrollRun.totalDeductions.toFixed(2),

      netPay: payrollRun.totalNetPay.toFixed(2),

      healthScore: payrollAudit.healthScore,

      riskLevel: payrollAudit.riskLevel,

      requestedByName: `${requestedBy.firstName} ${requestedBy.lastName}`,

      requestNote: requestNote ?? 'Payroll submitted for CEO approval.',

      approvalUrl,
    };

    let notificationEmailSent = false;

    try {
      await this.mailService.sendMail({
        to: recipient,

        subject: `CEO approval required: ${payrollRun.title}`,

        text: this.buildApprovalRequestText(emailInput),

        html: this.buildApprovalRequestHtml(emailInput),
      });

      notificationEmailSent = true;

      await this.prisma.payrollTimelineEvent.create({
        data: {
          organisationId,
          payrollRunId,

          actorUserId: requestedByUserId,

          eventType: 'PAYROLL_CEO_NOTIFICATION_SENT',

          title: 'CEO approval email sent',

          message: 'The CEO was notified that payroll is awaiting approval.',

          metadata: {
            approvalId: approval.id,

            recipient: this.maskEmail(recipient),

            notificationChannel: 'EMAIL',
          },
        },
      });
    } catch (error) {
      this.logger.error(
        `CEO approval request was created, but the notification email could not be sent to ${recipient}.`,
        error instanceof Error ? error.stack : String(error),
      );

      await this.prisma.payrollTimelineEvent.create({
        data: {
          organisationId,
          payrollRunId,

          actorUserId: requestedByUserId,

          eventType: 'PAYROLL_CEO_NOTIFICATION_FAILED',

          title: 'CEO approval email failed',

          message:
            'The payroll approval request was created, but the CEO notification email could not be sent.',

          metadata: {
            approvalId: approval.id,

            recipient: this.maskEmail(recipient),

            notificationChannel: 'EMAIL',
          },
        },
      });
    }

    return {
      ...approval,

      notificationEmailSent,

      notificationRecipient: this.maskEmail(recipient),
    };
  }

  async getCeoApproval(organisationId: string, payrollRunId: string) {
    const approval = await this.prisma.payrollApproval.findFirst({
      where: {
        organisationId,
        payrollRunId,

        approvalType: PayrollApprovalType.CEO_APPROVAL,
      },

      include: {
        requestedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },

        approver: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },

      orderBy: {
        requestedAt: 'desc',
      },
    });

    if (!approval) {
      throw new NotFoundException('CEO approval request was not found.');
    }

    return approval;
  }

  private getNotificationRecipient(approverEmail: string) {
    return (
      this.configService.get<string>('PAYROLL_TEST_RECIPIENT')?.trim() ||
      approverEmail
    );
  }

  private getApprovalUrl(payrollRunId: string) {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL')?.replace(/\/+$/, '') ??
      'http://localhost:3000';

    return `${frontendUrl}/dashboard/payroll/runs/${payrollRunId}`;
  }

  private formatMoney(value: string) {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(Number(value));
  }

  private getMonthName(month: number, year: number) {
    return new Intl.DateTimeFormat('en-ZA', {
      month: 'long',
      year: 'numeric',
    }).format(new Date(year, month - 1, 1));
  }

  private buildApprovalRequestText(input: ApprovalEmailInput) {
    return [
      `Hello ${input.approverName},`,
      '',
      `A payroll run for ${input.organisationName} is awaiting your approval.`,
      '',
      `Payroll: ${input.payrollTitle}`,
      `Period: ${this.getMonthName(input.periodMonth, input.periodYear)}`,
      `Employees: ${input.employeeCount}`,
      `Gross pay: ${this.formatMoney(input.grossPay)}`,
      `Deductions: ${this.formatMoney(input.deductions)}`,
      `Net pay: ${this.formatMoney(input.netPay)}`,
      `Payroll health score: ${input.healthScore}/100`,
      `Risk level: ${input.riskLevel}`,
      `Requested by: ${input.requestedByName}`,
      '',
      `Note: ${input.requestNote}`,
      '',
      'Sign in to MedCNX to review the payroll and complete secure OTP approval:',
      input.approvalUrl,
      '',
      'This email does not approve or pay the payroll. Approval must be completed inside the secure MedCNX portal.',
    ].join('\n');
  }

  private buildApprovalRequestHtml(input: ApprovalEmailInput) {
    return `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1"
          />
          <title>CEO Payroll Approval Required</title>
        </head>

        <body
          style="
            margin: 0;
            background: #f4f6f8;
            font-family: Arial, Helvetica, sans-serif;
            color: #111827;
          "
        >
          <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            style="
              background: #f4f6f8;
              padding: 32px 16px;
            "
          >
            <tr>
              <td align="center">
                <table
                  role="presentation"
                  width="100%"
                  cellspacing="0"
                  cellpadding="0"
                  style="
                    max-width: 680px;
                    background: #ffffff;
                    border: 1px solid #dfe3e8;
                  "
                >
                  <tr>
                    <td
                      style="
                        padding: 28px 32px;
                        background: #111827;
                        color: #ffffff;
                      "
                    >
                      <div
                        style="
                          font-size: 12px;
                          letter-spacing: 3px;
                          text-transform: uppercase;
                          color: #b8c0cc;
                        "
                      >
                        MedCNX Payroll
                      </div>

                      <h1
                        style="
                          margin: 12px 0 0;
                          font-size: 26px;
                          line-height: 1.25;
                        "
                      >
                        CEO approval required
                      </h1>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding: 32px;">
                      <p
                        style="
                          margin: 0 0 18px;
                          font-size: 16px;
                          line-height: 1.7;
                        "
                      >
                        Hello ${input.approverName},
                      </p>

                      <p
                        style="
                          margin: 0 0 24px;
                          font-size: 15px;
                          line-height: 1.7;
                          color: #4b5563;
                        "
                      >
                        A payroll run for
                        <strong>
                          ${input.organisationName}
                        </strong>
                        is awaiting your review and
                        secure approval.
                      </p>

                      <table
                        role="presentation"
                        width="100%"
                        cellspacing="0"
                        cellpadding="0"
                        style="
                          border-collapse: collapse;
                          border: 1px solid #e5e7eb;
                        "
                      >
                        <tr>
                          <td
                            style="
                              padding: 12px 14px;
                              border-bottom: 1px solid #e5e7eb;
                              color: #6b7280;
                            "
                          >
                            Payroll
                          </td>

                          <td
                            style="
                              padding: 12px 14px;
                              border-bottom: 1px solid #e5e7eb;
                              text-align: right;
                              font-weight: 600;
                            "
                          >
                            ${input.payrollTitle}
                          </td>
                        </tr>

                        <tr>
                          <td
                            style="
                              padding: 12px 14px;
                              border-bottom: 1px solid #e5e7eb;
                              color: #6b7280;
                            "
                          >
                            Period
                          </td>

                          <td
                            style="
                              padding: 12px 14px;
                              border-bottom: 1px solid #e5e7eb;
                              text-align: right;
                              font-weight: 600;
                            "
                          >
                            ${this.getMonthName(
                              input.periodMonth,
                              input.periodYear,
                            )}
                          </td>
                        </tr>

                        <tr>
                          <td
                            style="
                              padding: 12px 14px;
                              border-bottom: 1px solid #e5e7eb;
                              color: #6b7280;
                            "
                          >
                            Employees
                          </td>

                          <td
                            style="
                              padding: 12px 14px;
                              border-bottom: 1px solid #e5e7eb;
                              text-align: right;
                              font-weight: 600;
                            "
                          >
                            ${input.employeeCount}
                          </td>
                        </tr>

                        <tr>
                          <td
                            style="
                              padding: 12px 14px;
                              border-bottom: 1px solid #e5e7eb;
                              color: #6b7280;
                            "
                          >
                            Gross pay
                          </td>

                          <td
                            style="
                              padding: 12px 14px;
                              border-bottom: 1px solid #e5e7eb;
                              text-align: right;
                              font-weight: 600;
                            "
                          >
                            ${this.formatMoney(input.grossPay)}
                          </td>
                        </tr>

                        <tr>
                          <td
                            style="
                              padding: 12px 14px;
                              border-bottom: 1px solid #e5e7eb;
                              color: #6b7280;
                            "
                          >
                            Deductions
                          </td>

                          <td
                            style="
                              padding: 12px 14px;
                              border-bottom: 1px solid #e5e7eb;
                              text-align: right;
                              font-weight: 600;
                            "
                          >
                            ${this.formatMoney(input.deductions)}
                          </td>
                        </tr>

                        <tr>
                          <td
                            style="
                              padding: 12px 14px;
                              border-bottom: 1px solid #e5e7eb;
                              color: #6b7280;
                            "
                          >
                            Net payroll
                          </td>

                          <td
                            style="
                              padding: 12px 14px;
                              border-bottom: 1px solid #e5e7eb;
                              text-align: right;
                              font-weight: 700;
                            "
                          >
                            ${this.formatMoney(input.netPay)}
                          </td>
                        </tr>

                        <tr>
                          <td
                            style="
                              padding: 12px 14px;
                              border-bottom: 1px solid #e5e7eb;
                              color: #6b7280;
                            "
                          >
                            Health score
                          </td>

                          <td
                            style="
                              padding: 12px 14px;
                              border-bottom: 1px solid #e5e7eb;
                              text-align: right;
                              font-weight: 600;
                            "
                          >
                            ${input.healthScore}/100
                          </td>
                        </tr>

                        <tr>
                          <td
                            style="
                              padding: 12px 14px;
                              color: #6b7280;
                            "
                          >
                            Risk level
                          </td>

                          <td
                            style="
                              padding: 12px 14px;
                              text-align: right;
                              font-weight: 600;
                            "
                          >
                            ${input.riskLevel}
                          </td>
                        </tr>
                      </table>

                      <div
                        style="
                          margin-top: 22px;
                          padding: 16px;
                          background: #f8fafc;
                          border-left: 4px solid #111827;
                        "
                      >
                        <div
                          style="
                            font-size: 12px;
                            text-transform: uppercase;
                            letter-spacing: 1.5px;
                            color: #6b7280;
                          "
                        >
                          Approval note
                        </div>

                        <p
                          style="
                            margin: 8px 0 0;
                            font-size: 14px;
                            line-height: 1.6;
                            color: #374151;
                          "
                        >
                          ${input.requestNote}
                        </p>
                      </div>

                      <p
                        style="
                          margin: 22px 0 0;
                          font-size: 13px;
                          color: #6b7280;
                        "
                      >
                        Requested by
                        ${input.requestedByName}
                      </p>

                      <table
                        role="presentation"
                        cellspacing="0"
                        cellpadding="0"
                        style="margin-top: 28px;"
                      >
                        <tr>
                          <td
                            style="
                              background: #111827;
                            "
                          >
                            <a
                              href="${input.approvalUrl}"
                              style="
                                display: inline-block;
                                padding: 14px 22px;
                                color: #ffffff;
                                text-decoration: none;
                                font-size: 14px;
                                font-weight: 600;
                              "
                            >
                              Open secure payroll approval
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p
                        style="
                          margin: 28px 0 0;
                          font-size: 12px;
                          line-height: 1.6;
                          color: #6b7280;
                        "
                      >
                        This message does not approve
                        payroll or initiate bank
                        payments. You must sign in to
                        MedCNX and verify your identity
                        using the secure OTP process.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
  }

  private maskEmail(email: string) {
    const [localPart, domain] = email.split('@');

    if (!localPart || !domain) {
      return '***';
    }

    return `${localPart.slice(0, 2)}${'*'.repeat(
      Math.max(3, localPart.length - 2),
    )}@${domain}`;
  }
}
