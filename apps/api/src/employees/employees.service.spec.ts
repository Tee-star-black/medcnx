import { Test, TestingModule } from '@nestjs/testing';
import { AccessScopeService } from '../auth/access-scope.service';
import { PrismaService } from '../database/prisma.service';
import { EmployeeNotificationService } from '../employee-self-service/employee-notification.service';
import { EmployeesService } from './employees.service';

describe('EmployeesService', () => {
  let service: EmployeesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: PrismaService, useValue: {} },
        {
          provide: EmployeeNotificationService,
          useValue: { notifyEmployee: jest.fn() },
        },
        {
          provide: AccessScopeService,
          useValue: {
            employeeWhere: jest.fn().mockResolvedValue({ organisationId: 'org-1' }),
            assertEmployeeAccess: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<EmployeesService>(EmployeesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
