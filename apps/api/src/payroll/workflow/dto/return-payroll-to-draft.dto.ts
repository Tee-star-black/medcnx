import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReturnPayrollToDraftDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}
