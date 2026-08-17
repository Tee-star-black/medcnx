import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateDepartmentStructureDto {
  @IsOptional()
  @IsString()
  parentDepartmentId?: string;

  @IsOptional()
  @IsString()
  headEmployeeId?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
