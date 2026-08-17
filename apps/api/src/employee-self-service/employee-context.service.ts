import { Injectable, NotFoundException } from '@nestjs/common';
import type { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class EmployeeContextService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(user: CurrentUser) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        userId: user.id,
        organisationId: user.organisationId,
      },
      include: {
        department: { select: { id: true, name: true } },
        organisation: { select: { id: true, name: true } },
        compensationProfile: {
          select: { bankName: true, bankAccountNumber: true },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException(
        'Your user account is not linked to an employee profile. Contact HR.',
      );
    }

    return employee;
  }
}
