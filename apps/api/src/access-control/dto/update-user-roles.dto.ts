import { ArrayMinSize, ArrayUnique, IsArray, IsString } from 'class-validator';

export class UpdateUserRolesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  roleIds!: string[];
}
