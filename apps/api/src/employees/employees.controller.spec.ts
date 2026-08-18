import { Test, TestingModule } from '@nestjs/testing';
import { EmployeeLifecycleService } from './employee-lifecycle.service';
import { EmployeeManagerService } from './employee-manager.service';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';

describe('EmployeesController', () => {
  let controller: EmployeesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmployeesController],
      providers: [
        { provide: EmployeesService, useValue: {} },
        { provide: EmployeeLifecycleService, useValue: {} },
        { provide: EmployeeManagerService, useValue: {} },
      ],
    }).compile();

    controller = module.get<EmployeesController>(EmployeesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
