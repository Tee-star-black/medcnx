import {
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ResolveFindingDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  resolutionNote: string;
}
