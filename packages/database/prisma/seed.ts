import "dotenv/config";

import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing in packages/database/.env");
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

const permissions = [
  // Organisation
  {
    key: "organisation:read",
    description: "View organisation details",
  },
  {
    key: "organisation:update",
    description: "Update organisation details",
  },

  // Users
  {
    key: "users:read",
    description: "View users",
  },
  {
    key: "users:create",
    description: "Create users",
  },
  {
    key: "users:update",
    description: "Update users",
  },
  {
    key: "users:disable",
    description: "Disable users",
  },

  // Employees
  {
    key: "employees:read",
    description: "View employees",
  },
  {
    key: "employees:create",
    description: "Create employees",
  },
  {
    key: "employees:update",
    description: "Update employees",
  },
  {
    key: "employees:delete",
    description: "Delete employees",
  },
  { key: "profile:view-own", description: "View own employee profile" },
  {
    key: "profile:request-change",
    description: "Request changes to own employee profile",
  },
  {
    key: "profile:review-changes",
    description: "Review employee profile change requests",
  },
  {
    key: "notifications:view-own",
    description: "View own employee notifications",
  },
  {
    key: "notifications:update-own",
    description: "Update own employee notification read state",
  },

  // Departments
  {
    key: "departments:read",
    description: "View departments",
  },
  {
    key: "departments:create",
    description: "Create departments",
  },
  {
    key: "departments:update",
    description: "Update departments",
  },

  // Attendance
  {
    key: "attendance:read",
    description: "View attendance records",
  },
  {
    key: "attendance:manage",
    description: "Manage attendance records",
  },
  { key: "attendance:view-own", description: "View own attendance" },
  { key: "attendance:clock-in", description: "Clock in to attendance" },
  { key: "attendance:clock-out", description: "Clock out of attendance" },
  {
    key: "attendance:request-correction",
    description: "Request corrections to own attendance",
  },
  {
    key: "attendance:view-organisation",
    description: "View organisation attendance",
  },
  {
    key: "attendance:review-corrections",
    description: "Approve or reject attendance corrections",
  },
  {
    key: "attendance:edit-records",
    description: "Edit attendance records with an audit trail",
  },
  {
    key: "attendance:manage-policy",
    description: "Manage attendance policy",
  },
  { key: "attendance:export", description: "Export attendance reports" },

  // Leave
  {
    key: "leave:read",
    description: "View leave records",
  },
  {
    key: "leave:create",
    description: "Create leave requests",
  },
  {
    key: "leave:update",
    description: "Update leave requests",
  },
  {
    key: "leave:approve",
    description: "Approve leave requests",
  },
  {
    key: "leave:reject",
    description: "Reject leave requests",
  },

  // Documents
  {
    key: "documents:read",
    description: "View HR documents",
  },
  {
    key: "documents:upload",
    description: "Upload HR documents",
  },
  {
    key: "documents:download",
    description: "Download HR documents",
  },
  { key: "document_templates:read", description: "View document templates" },
  { key: "document_templates:create", description: "Upload document templates" },
  { key: "document_templates:update", description: "Update and activate document templates" },
  { key: "document_templates:archive", description: "Archive document templates" },
  { key: "generated_documents:read", description: "View generated documents" },
  { key: "generated_documents:create", description: "Generate employee documents" },
  { key: "generated_documents:preview", description: "Preview generated documents" },
  { key: "generated_documents:publish", description: "Publish generated documents" },
  { key: "generated_documents:approve", description: "Approve protected generated documents" },
  { key: "generated_documents:reject", description: "Reject protected generated documents" },
  { key: "generated_documents:download", description: "Download generated documents" },
  { key: "generated_documents:view-all", description: "View all generated documents in the organisation" },
  { key: "generated_documents:view-own", description: "View own published generated documents" },
  { key: "organisation_branding:manage", description: "Manage document branding" },
  { key: "organisation_signature:manage", description: "Manage the private CEO signature" },
  { key: "organisation_signature:use", description: "Insert the CEO signature during document generation" },

  // Legacy payslip permissions
  {
    key: "payslips:read",
    description: "View payslips",
  },
  {
    key: "payslips:upload",
    description: "Upload payslips",
  },

  // Recruitment
  {
    key: "recruitment:read",
    description: "View recruitment records",
  },
  {
    key: "recruitment:manage",
    description: "Manage recruitment records",
  },

  // Policies
  {
    key: "policies:read",
    description: "View policies",
  },
  {
    key: "policies:manage",
    description: "Manage policies",
  },

  // Reports and settings
  {
    key: "reports:read",
    description: "View reports",
  },
  {
    key: "audit_logs:read",
    description: "View audit logs",
  },
  {
    key: "settings:manage",
    description: "Manage organisation settings",
  },

  // Payroll runs
  {
    key: "payroll:read",
    description: "View organisation payroll",
  },
  {
    key: "payroll:create",
    description: "Create payroll runs",
  },
  {
    key: "payroll:calculate",
    description: "Calculate payroll",
  },
  {
    key: "payroll:update-inputs",
    description: "Update payroll inputs",
  },
  {
    key: "payroll:delete-draft",
    description: "Delete draft payroll runs",
  },

  // Payroll intelligence
  {
    key: "payroll:run-audit",
    description: "Run payroll intelligence audits",
  },
  {
    key: "payroll:view-findings",
    description: "View payroll audit findings",
  },
  {
    key: "payroll:resolve-findings",
    description: "Resolve payroll audit findings",
  },

  // Payroll workflow
  {
    key: "payroll:hr-review",
    description: "Complete payroll HR review",
  },
  {
    key: "payroll:finance-review",
    description: "Complete payroll finance review",
  },
  {
    key: "payroll:submit",
    description: "Submit payroll for approval",
  },
  {
    key: "payroll:approve",
    description: "Approve payroll",
  },
  {
    key: "payroll:reject",
    description: "Reject payroll",
  },
  {
    key: "payroll:finalise",
    description: "Finalise payroll",
  },
  {
    key: "payroll:reopen",
    description: "Reopen payroll",
  },

  // Payroll reporting and exports
  {
    key: "payroll:view-reports",
    description: "View payroll reports",
  },
  {
    key: "payroll:export",
    description: "Export payroll data",
  },
  {
    key: "payroll:view-bank-details",
    description: "View payroll banking details",
  },
  {
    key: "payroll:export-bank-file",
    description: "Export bank payment files",
  },

  // Compensation
  {
    key: "compensation:read",
    description: "View compensation profiles",
  },
  {
    key: "compensation:create",
    description: "Create compensation profiles",
  },
  {
    key: "compensation:update",
    description: "Update compensation profiles",
  },
  {
    key: "compensation:view-sensitive",
    description: "View sensitive compensation data",
  },

  // Payslips
  {
    key: "payslips:view-own",
    description: "View own released payslips",
  },
  {
    key: "payslips:view-all",
    description: "View organisation payslips",
  },
  {
    key: "payslips:generate",
    description: "Generate payslips",
  },

  // Payroll audit
  {
    key: "audit:read",
    description: "View payroll audit records",
  },
  {
    key: "audit:export",
    description: "Export payroll audit records",
  },

  // Performance and development
  { key: "performance:read", description: "View organisation performance records" },
  { key: "performance:manage", description: "Manage assessment templates and cycles" },
  { key: "performance:assign", description: "Assign performance reviewers" },
  { key: "performance:finalise", description: "Finalise employee performance reviews" },
  { key: "performance:view-reports", description: "View performance analytics and reports" },
  { key: "performance:review-assigned", description: "Complete assigned performance reviews" },
  { key: "performance:view-own", description: "View own performance record" },
  { key: "performance:acknowledge-own", description: "Acknowledge own final performance reviews" },
  { key: "performance:manage-goals", description: "Manage goals and development plans" },
];

const allPermissionKeys = permissions.map((permission) => permission.key);

const organisationAdminPermissions = allPermissionKeys.filter(
  (permissionKey) => permissionKey !== "payroll:approve",
);

const rolePermissionMap: Record<string, string[]> = {
  SUPER_ADMIN: allPermissionKeys,

  ORG_ADMIN: organisationAdminPermissions,

  PAYROLL_ADMIN: [
    "payroll:read",
    "payroll:create",
    "payroll:calculate",
    "payroll:update-inputs",
    "payroll:delete-draft",

    "payroll:run-audit",
    "payroll:view-findings",
    "payroll:resolve-findings",

    "payroll:submit",
    "payroll:view-reports",
    "payroll:export",

    "compensation:read",
    "compensation:create",
    "compensation:update",
    "compensation:view-sensitive",

    "payslips:view-all",
    "payslips:generate",

    "employees:read",
    "departments:read",
  ],

  HR_MANAGER: [
    "organisation:read",

    "users:read",

    "employees:read",
    "employees:create",
    "employees:update",
    "profile:view-own",
    "profile:request-change",
    "profile:review-changes",
    "notifications:view-own",
    "notifications:update-own",

    "departments:read",
    "departments:create",
    "departments:update",

    "attendance:read",
    "attendance:manage",
    "attendance:view-own",
    "attendance:clock-in",
    "attendance:clock-out",
    "attendance:request-correction",
    "attendance:view-organisation",
    "attendance:review-corrections",
    "attendance:edit-records",
    "attendance:manage-policy",
    "attendance:export",

    "leave:read",
    "leave:create",
    "leave:update",
    "leave:approve",
    "leave:reject",

    "documents:read",
    "documents:upload",
    "documents:download",
    "document_templates:read",
    "document_templates:create",
    "document_templates:update",
    "document_templates:archive",
    "generated_documents:read",
    "generated_documents:create",
    "generated_documents:preview",
    "generated_documents:publish",
    "generated_documents:download",
    "generated_documents:view-all",

    "payslips:read",
    "payslips:upload",
    "payslips:view-all",

    "recruitment:read",
    "recruitment:manage",

    "policies:read",
    "reports:read",
    "audit_logs:read",

    "payroll:read",
    "payroll:view-findings",
    "payroll:hr-review",

    "compensation:read",
    "performance:read",
    "performance:manage",
    "performance:assign",
    "performance:finalise",
    "performance:view-reports",
    "performance:review-assigned",
    "performance:view-own",
    "performance:acknowledge-own",
    "performance:manage-goals",
  ],

  MANAGER: [
    "organisation:read",

    "employees:read",
    "profile:view-own",
    "profile:request-change",
    "notifications:view-own",
    "notifications:update-own",
    "departments:read",

    "attendance:read",
    "attendance:view-own",
    "attendance:clock-in",
    "attendance:clock-out",
    "attendance:request-correction",
    "attendance:view-organisation",
    "attendance:review-corrections",
    "attendance:export",

    "leave:read",
    "leave:approve",
    "leave:reject",

    "documents:read",
    "policies:read",
    "reports:read",

    "payroll:read",
    "payroll:view-findings",
    "payroll:finance-review",
    "payroll:view-reports",

    "compensation:read",
    "payslips:view-all",
    "performance:read",
    "performance:assign",
    "performance:finalise",
    "performance:view-reports",
    "performance:review-assigned",
    "performance:view-own",
    "performance:acknowledge-own",
    "performance:manage-goals",
  ],

  PAYROLL_APPROVER: [
    "organisation:read",

    "payroll:read",
    "payroll:view-findings",
    "payroll:approve",
    "payroll:reject",

    "payslips:view-all",
    "document_templates:read",
    "generated_documents:read",
    "generated_documents:preview",
    "generated_documents:approve",
    "generated_documents:reject",
    "generated_documents:download",
    "generated_documents:view-all",
  ],

  AUDITOR: [
    "organisation:read",

    "payroll:read",
    "payroll:view-findings",
    "payroll:view-reports",

    "audit:read",
    "audit_logs:read",
    "reports:read",
  ],

  EMPLOYEE: [
    "profile:view-own",
    "profile:request-change",
    "notifications:view-own",
    "notifications:update-own",
    "attendance:view-own",
    "attendance:clock-in",
    "attendance:clock-out",
    "attendance:request-correction",

    "leave:create",

    "documents:read",
    "documents:download",
    "generated_documents:view-own",
    "generated_documents:download",

    "payslips:read",
    "payslips:view-own",

    "policies:read",
    "performance:review-assigned",
    "performance:view-own",
    "performance:acknowledge-own",
  ],
};

type DemoEmployeeSeed = {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  jobTitle: string;
  employmentType: string;
  departmentName: string;
  roleName: string;
  basicSalary: number;
  bankName: string;
  bankAccountNumber: string;
  paymentReference: string;
};

const demoEmployees: DemoEmployeeSeed[] = [
  {
    employeeNumber: "MED-0001",
    firstName: "Naledi",
    lastName: "Mokoena",
    email: "hr@medcnx.local",
    phone: "+27 71 100 0001",
    password: "Password123!",
    jobTitle: "HR Manager",
    employmentType: "PERMANENT",
    departmentName: "Human Resources",
    roleName: "HR_MANAGER",
    basicSalary: 42000,
    bankName: "FNB",
    bankAccountNumber: "620000000001",
    paymentReference: "MED-0001",
  },
  {
    employeeNumber: "MED-0002",
    firstName: "Thabo",
    lastName: "Nkosi",
    email: "finance@medcnx.local",
    phone: "+27 71 100 0002",
    password: "Password123!",
    jobTitle: "Finance Manager",
    employmentType: "PERMANENT",
    departmentName: "Finance",
    roleName: "MANAGER",
    basicSalary: 48000,
    bankName: "FNB",
    bankAccountNumber: "620000000002",
    paymentReference: "MED-0002",
  },
  {
    employeeNumber: "MED-0003",
    firstName: "Lerato",
    lastName: "Maseko",
    email: "ceo@medcnx.local",
    phone: "+27 71 100 0003",
    password: "Password123!",
    jobTitle: "Chief Executive Officer",
    employmentType: "PERMANENT",
    departmentName: "Executive",
    roleName: "PAYROLL_APPROVER",
    basicSalary: 95000,
    bankName: "FNB",
    bankAccountNumber: "620000000003",
    paymentReference: "MED-0003",
  },
  {
    employeeNumber: "MED-0004",
    firstName: "Karabo",
    lastName: "Molefe",
    email: "nurse@medcnx.local",
    phone: "+27 71 100 0004",
    password: "Password123!",
    jobTitle: "Professional Nurse",
    employmentType: "PERMANENT",
    departmentName: "Clinical",
    roleName: "EMPLOYEE",
    basicSalary: 28500,
    bankName: "FNB",
    bankAccountNumber: "620000000004",
    paymentReference: "MED-0004",
  },
  {
    employeeNumber: "MED-0005",
    firstName: "Ayanda",
    lastName: "Dlamini",
    email: "employee@medcnx.local",
    phone: "+27 71 100 0005",
    password: "Password123!",
    jobTitle: "Receptionist",
    employmentType: "PERMANENT",
    departmentName: "Administration",
    roleName: "EMPLOYEE",
    basicSalary: 14500,
    bankName: "FNB",
    bankAccountNumber: "620000000005",
    paymentReference: "MED-0005",
  },
];

async function upsertDepartment(
  organisationId: string,
  name: string,
  description: string,
) {
  return prisma.department.upsert({
    where: {
      organisationId_name: {
        organisationId,
        name,
      },
    },
    update: {
      description,
    },
    create: {
      organisationId,
      name,
      description,
    },
  });
}

async function assignRole(userId: string, roleId: string) {
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId,
        roleId,
      },
    },
    update: {},
    create: {
      userId,
      roleId,
    },
  });
}

async function seedPermissions() {
  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: {
        key: permission.key,
      },
      update: {
        description: permission.description,
      },
      create: permission,
    });
  }
}

async function seedRoles(organisationId: string) {
  for (const [roleName, permissionKeys] of Object.entries(rolePermissionMap)) {
    const role = await prisma.role.upsert({
      where: {
        organisationId_name: {
          organisationId,
          name: roleName,
        },
      },
      update: {
        description: `${roleName} role`,
        isSystem: true,
      },
      create: {
        organisationId,
        name: roleName,
        description: `${roleName} role`,
        isSystem: true,
      },
    });

    /*
     * Synchronise this system role with the
     * permission map.
     *
     * This prevents obsolete permissions from
     * remaining attached after role rules change.
     */
    await prisma.rolePermission.deleteMany({
      where: {
        roleId: role.id,
      },
    });

    const rolePermissions = await prisma.permission.findMany({
      where: {
        key: {
          in: permissionKeys,
        },
      },
      select: {
        id: true,
        key: true,
      },
    });

    if (rolePermissions.length !== permissionKeys.length) {
      const foundKeys = new Set(
        rolePermissions.map((permission) => permission.key),
      );

      const missingKeys = permissionKeys.filter(
        (permissionKey) => !foundKeys.has(permissionKey),
      );

      throw new Error(
        `Missing permissions for ${roleName}: ${missingKeys.join(", ")}`,
      );
    }

    await prisma.rolePermission.createMany({
      data: rolePermissions.map((permission) => ({
        roleId: role.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });
  }
}

async function main() {
  console.log("Seeding MedCNX database...");

  await seedPermissions();

  const organisation = await prisma.organisation.upsert({
    where: {
      slug: "medcnx-demo-clinic",
    },
    update: {
      name: "MedCNX Demo Clinic",
      email: "admin@medcnx.local",
      phone: "+27 11 000 0000",
      city: "Johannesburg",
      province: "Gauteng",
      country: "South Africa",
    },
    create: {
      name: "MedCNX Demo Clinic",
      slug: "medcnx-demo-clinic",
      email: "admin@medcnx.local",
      phone: "+27 11 000 0000",
      city: "Johannesburg",
      province: "Gauteng",
      country: "South Africa",
    },
  });

  await seedRoles(organisation.id);

  const administrationDepartment = await upsertDepartment(
    organisation.id,
    "Administration",
    "Administrative and front-office operations",
  );

  await upsertDepartment(
    organisation.id,
    "Human Resources",
    "Human resources and employee management",
  );

  await upsertDepartment(
    organisation.id,
    "Finance",
    "Finance, payroll and accounting",
  );

  await upsertDepartment(
    organisation.id,
    "Executive",
    "Executive management and business leadership",
  );

  await upsertDepartment(
    organisation.id,
    "Clinical",
    "Clinical and medical operations",
  );

  const adminPasswordHash = await bcrypt.hash("Password123!", 12);

  const adminUser = await prisma.user.upsert({
    where: {
      organisationId_email: {
        organisationId: organisation.id,
        email: "admin@medcnx.local",
      },
    },
    update: {
      firstName: "MedCNX",
      lastName: "Admin",
      passwordHash: adminPasswordHash,
      status: "ACTIVE",
    },
    create: {
      organisationId: organisation.id,
      email: "admin@medcnx.local",
      passwordHash: adminPasswordHash,
      firstName: "MedCNX",
      lastName: "Admin",
      status: "ACTIVE",
    },
  });

  const orgAdminRole = await prisma.role.findUniqueOrThrow({
    where: {
      organisationId_name: {
        organisationId: organisation.id,
        name: "ORG_ADMIN",
      },
    },
  });

  await assignRole(adminUser.id, orgAdminRole.id);

  const adminEmployee = await prisma.employee.upsert({
    where: {
      organisationId_employeeNumber: {
        organisationId: organisation.id,
        employeeNumber: "MED-ADMIN-001",
      },
    },
    update: {
      userId: adminUser.id,
      departmentId: administrationDepartment.id,
      firstName: "MedCNX",
      lastName: "Admin",
      email: "admin@medcnx.local",
      phone: "+27 11 000 0000",
      jobTitle: "System Administrator",
      employmentType: "PERMANENT",
      employmentStatus: "ACTIVE",
    },
    create: {
      organisationId: organisation.id,
      userId: adminUser.id,
      departmentId: administrationDepartment.id,
      employeeNumber: "MED-ADMIN-001",
      firstName: "MedCNX",
      lastName: "Admin",
      email: "admin@medcnx.local",
      phone: "+27 11 000 0000",
      jobTitle: "System Administrator",
      employmentType: "PERMANENT",
      employmentStatus: "ACTIVE",
      startDate: new Date("2026-01-01"),
      nationality: "South African",
    },
  });

  await prisma.employeeCompensationProfile.upsert({
    where: {
      employeeId: adminEmployee.id,
    },
    update: {
      organisationId: organisation.id,
      paymentFrequency: "MONTHLY",
      basicSalary: 60000,
      autoPaye: true,
      uifEnabled: true,
      pensionEmployee: 0,
      pensionEmployer: 0,
      medicalAidEmployee: 0,
      medicalAidEmployer: 0,
      defaultAllowances: 0,
      defaultOtherDeductions: 0,
      bankName: "FNB",
      bankAccountNumber: "620000000000",
      paymentReference: "MED-ADMIN-001",
    },
    create: {
      organisationId: organisation.id,
      employeeId: adminEmployee.id,
      paymentFrequency: "MONTHLY",
      basicSalary: 60000,
      autoPaye: true,
      uifEnabled: true,
      pensionEmployee: 0,
      pensionEmployer: 0,
      medicalAidEmployee: 0,
      medicalAidEmployer: 0,
      defaultAllowances: 0,
      defaultOtherDeductions: 0,
      bankName: "FNB",
      bankAccountNumber: "620000000000",
      paymentReference: "MED-ADMIN-001",
    },
  });

  for (const demoEmployee of demoEmployees) {
    const department = await prisma.department.findUniqueOrThrow({
      where: {
        organisationId_name: {
          organisationId: organisation.id,
          name: demoEmployee.departmentName,
        },
      },
    });

    const role = await prisma.role.findUniqueOrThrow({
      where: {
        organisationId_name: {
          organisationId: organisation.id,
          name: demoEmployee.roleName,
        },
      },
    });

    const passwordHash = await bcrypt.hash(demoEmployee.password, 12);

    const user = await prisma.user.upsert({
      where: {
        organisationId_email: {
          organisationId: organisation.id,
          email: demoEmployee.email,
        },
      },
      update: {
        firstName: demoEmployee.firstName,
        lastName: demoEmployee.lastName,
        phone: demoEmployee.phone,
        passwordHash,
        status: "ACTIVE",
      },
      create: {
        organisationId: organisation.id,
        email: demoEmployee.email,
        passwordHash,
        firstName: demoEmployee.firstName,
        lastName: demoEmployee.lastName,
        phone: demoEmployee.phone,
        status: "ACTIVE",
      },
    });

    /*
     * Demo users receive exactly one expected
     * business role. This prevents an old demo
     * assignment from preserving excessive access.
     */
    await prisma.userRole.deleteMany({
      where: {
        userId: user.id,
      },
    });

    await assignRole(user.id, role.id);

    const employee = await prisma.employee.upsert({
      where: {
        organisationId_employeeNumber: {
          organisationId: organisation.id,
          employeeNumber: demoEmployee.employeeNumber,
        },
      },
      update: {
        userId: user.id,
        departmentId: department.id,
        firstName: demoEmployee.firstName,
        lastName: demoEmployee.lastName,
        email: demoEmployee.email,
        phone: demoEmployee.phone,
        jobTitle: demoEmployee.jobTitle,
        employmentType: demoEmployee.employmentType,
        employmentStatus: "ACTIVE",
      },
      create: {
        organisationId: organisation.id,
        userId: user.id,
        departmentId: department.id,
        employeeNumber: demoEmployee.employeeNumber,
        firstName: demoEmployee.firstName,
        lastName: demoEmployee.lastName,
        email: demoEmployee.email,
        phone: demoEmployee.phone,
        jobTitle: demoEmployee.jobTitle,
        employmentType: demoEmployee.employmentType,
        employmentStatus: "ACTIVE",
        startDate: new Date("2026-01-01"),
        nationality: "South African",
      },
    });

    await prisma.employeeCompensationProfile.upsert({
      where: {
        employeeId: employee.id,
      },
      update: {
        organisationId: organisation.id,
        paymentFrequency: "MONTHLY",
        basicSalary: demoEmployee.basicSalary,
        autoPaye: true,
        uifEnabled: true,
        pensionEmployee: 0,
        pensionEmployer: 0,
        medicalAidEmployee: 0,
        medicalAidEmployer: 0,
        defaultAllowances: 0,
        defaultOtherDeductions: 0,
        bankName: demoEmployee.bankName,
        bankAccountNumber: demoEmployee.bankAccountNumber,
        paymentReference: demoEmployee.paymentReference,
      },
      create: {
        organisationId: organisation.id,
        employeeId: employee.id,
        paymentFrequency: "MONTHLY",
        basicSalary: demoEmployee.basicSalary,
        autoPaye: true,
        uifEnabled: true,
        pensionEmployee: 0,
        pensionEmployer: 0,
        medicalAidEmployee: 0,
        medicalAidEmployer: 0,
        defaultAllowances: 0,
        defaultOtherDeductions: 0,
        bankName: demoEmployee.bankName,
        bankAccountNumber: demoEmployee.bankAccountNumber,
        paymentReference: demoEmployee.paymentReference,
      },
    });

    console.log(
      `Created demo employee: ${demoEmployee.firstName} ${demoEmployee.lastName}`,
    );
  }

  await prisma.performanceTemplate.upsert({
    where: {
      organisationId_name: {
        organisationId: organisation.id,
        name: "MedCNX Core Performance Review",
      },
    },
    update: {
      description:
        "Balanced review covering delivery, quality, teamwork and development.",
      type: "ANNUAL",
      status: "ACTIVE",
      anonymous: false,
    },
    create: {
      organisationId: organisation.id,
      name: "MedCNX Core Performance Review",
      description:
        "Balanced review covering delivery, quality, teamwork and development.",
      type: "ANNUAL",
      status: "ACTIVE",
      anonymous: false,
      createdByUserId: adminUser.id,
      questions: [
        {
          id: "role_delivery",
          label: "Consistently delivers the responsibilities of the role",
          type: "RATING",
          required: true,
          maxScore: 5,
        },
        {
          id: "quality",
          label: "Demonstrates quality, accuracy and professional judgement",
          type: "RATING",
          required: true,
          maxScore: 5,
        },
        {
          id: "teamwork",
          label: "Communicates effectively and contributes to the team",
          type: "RATING",
          required: true,
          maxScore: 5,
        },
        {
          id: "strengths",
          label: "What are this employee's most important strengths?",
          type: "TEXT",
          required: true,
        },
        {
          id: "development",
          label: "What development would have the greatest positive impact?",
          type: "TEXT",
          required: true,
        },
      ],
    },
  });

  const competencies = [
    {
      name: "Patient-centred care",
      category: "Clinical excellence",
      description: "Provides safe, respectful and responsive patient care.",
    },
    {
      name: "Quality and compliance",
      category: "Operational excellence",
      description: "Follows clinical, regulatory and organisational standards.",
    },
    {
      name: "Communication",
      category: "Core behaviour",
      description: "Communicates clearly, respectfully and at the right time.",
    },
    {
      name: "Teamwork",
      category: "Core behaviour",
      description: "Collaborates constructively across roles and departments.",
    },
    {
      name: "Reliability",
      category: "Core behaviour",
      description: "Honours commitments and takes ownership of outcomes.",
    },
    {
      name: "Leadership",
      category: "Leadership",
      description: "Sets direction, develops others and models accountability.",
    },
  ];

  for (const competency of competencies) {
    await prisma.performanceCompetency.upsert({
      where: {
        organisationId_name: {
          organisationId: organisation.id,
          name: competency.name,
        },
      },
      update: {
        ...competency,
        active: true,
      },
      create: {
        organisationId: organisation.id,
        createdByUserId: adminUser.id,
        active: true,
        behaviouralIndicators: [],
        ...competency,
      },
    });
  }

  console.log("");
  console.log("MedCNX database seeded successfully.");
  console.log("");
  console.log("Demo logins:");
  console.log("Admin: admin@medcnx.local / Password123!");
  console.log("HR: hr@medcnx.local / Password123!");
  console.log("Finance: finance@medcnx.local / Password123!");
  console.log("CEO: ceo@medcnx.local / Password123!");
  console.log("Nurse: nurse@medcnx.local / Password123!");
  console.log("Employee: employee@medcnx.local / Password123!");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);

    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
