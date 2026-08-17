import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateDepartmentStructureDto {
  @IsOptional()
  @IsString()
  parentDepartmentId?: string | null;

  @IsOptional()
  @IsString()
  headEmployeeId?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
