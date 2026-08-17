import { ArrayMinSize, ArrayUnique, IsArray, IsString } from 'class-validator';

export class UpdateRolePermissionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  permissionIds!: string[];
}
