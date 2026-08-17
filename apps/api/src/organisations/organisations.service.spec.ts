import { Test, TestingModule } from '@nestjs/testing';
import { OrganisationsService } from './organisations.service';
import { PrismaService } from '../database/prisma.service';

describe('OrganisationsService', () => {
  let service: OrganisationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganisationsService,
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    service = module.get<OrganisationsService>(OrganisationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
