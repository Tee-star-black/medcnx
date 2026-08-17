import { IsIn } from 'class-validator';

export class UpdateUserStatusDto {
  @IsIn(['ACTIVE', 'SUSPENDED', 'DISABLED'])
  status!: 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
}
