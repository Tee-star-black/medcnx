import {
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class AcknowledgeFindingDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
