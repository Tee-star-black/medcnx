import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsNumberString,
  IsOptional,
  Matches,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class DocumentMappingOverridesDto {
  @IsOptional() @IsString() @MaxLength(100) firstName?: string;
  @IsOptional() @IsString() @MaxLength(100) lastName?: string;
  @IsOptional() @IsEmail() @MaxLength(200) email?: string;
  @IsOptional() @IsString() @MaxLength(160) jobTitle?: string;
  @IsOptional() @IsString() @MaxLength(160) department?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsString() @MaxLength(80) employmentStatus?: string;
  @IsOptional() @IsNumberString() basicSalary?: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional()
  @Matches(/^\d{13}$/, { message: 'idNumber must contain exactly 13 digits.' })
  idNumber?: string;
  @IsOptional() @IsString() @MaxLength(200) organisationName?: string;
  @IsOptional() @IsString() @MaxLength(500) organisationAddress?: string;
  @IsOptional() @IsEmail() @MaxLength(200) organisationEmail?: string;
  @IsOptional() @IsString() @MaxLength(80) organisationPhone?: string;
  @IsOptional()
  @Matches(/^(?:\+27|0)[6-8]\d{8}$/, {
    message: 'phone must be a valid South African mobile number.',
  })
  phone?: string;
  @IsOptional()
  @IsString()
  @MaxLength(120)
  organisationRegistrationNumber?: string;
  @IsOptional() @IsString() @MaxLength(160) positionTitle?: string;
  @IsOptional() @IsString() @MaxLength(80) commencementDate?: string;
  @IsOptional() @IsString() @MaxLength(300) reportingLine?: string;
  @IsOptional() @IsString() @MaxLength(200) natureOfEmployment?: string;
  @IsOptional() @IsString() @MaxLength(500) hoursOfWork?: string;
  @IsOptional() @IsString() @MaxLength(500) remunerationPackage?: string;
  @IsOptional() @IsString() @MaxLength(1000) regulatoryCompliance?: string;
  @IsOptional() @IsString() @MaxLength(80) expiryDate?: string;
  @IsOptional() @IsString() @MaxLength(200) addresseeName?: string;
  @IsOptional() @IsString() @MaxLength(500) addresseeAddress?: string;
  @IsOptional()
  @IsString()
  @MaxLength(120)
  professionalRegistrationNumber?: string;
  @IsOptional() @IsString() @MaxLength(300) remunerationInWords?: string;
  @IsOptional() @IsString() @MaxLength(120) payeReferenceNumber?: string;
  @IsOptional() @IsString() @MaxLength(80) payPeriod?: string;
  @IsOptional() @IsString() @MaxLength(120) bankAccountMasked?: string;
  @IsOptional() @IsString() @MaxLength(100) bankName?: string;
  @IsOptional() @IsString() @MaxLength(300) allowancesDetails?: string;
  @IsOptional() @IsString() @MaxLength(80) contractType?: string;
  @IsOptional() @IsString() @MaxLength(80) employmentSchedule?: string;
  @IsOptional() @IsString() @MaxLength(80) endDate?: string;
  @IsOptional() @IsString() @MaxLength(80) probationPeriod?: string;
  @IsOptional() @IsString() @MaxLength(300) workLocation?: string;
  @IsOptional() @IsString() @MaxLength(120) noticePeriod?: string;
  @IsOptional() @IsString() @MaxLength(120) professionalCouncil?: string;
  @IsOptional() @IsString() @MaxLength(1000) specialConditions?: string;
  @IsOptional() @IsString() @MaxLength(500) confirmationPurpose?: string;
  @IsOptional() @IsString() @MaxLength(120) leaveType?: string;
  @IsOptional() @IsDateString() leaveStartDate?: string;
  @IsOptional() @IsDateString() leaveEndDate?: string;
  @IsOptional() @Matches(/^\d+(\.\d+)?$/) leaveDays?: string;
  @IsOptional() @IsDateString() incidentDate?: string;
  @IsOptional() @IsString() @MaxLength(2000) incidentDescription?: string;
  @IsOptional() @IsDateString() hearingDate?: string;
  @IsOptional() @IsString() @MaxLength(300) hearingLocation?: string;
  @IsOptional() @IsString() @MaxLength(200) chairperson?: string;
  @IsOptional() @IsString() @MaxLength(120) warningLevel?: string;
  @IsOptional() @IsDateString() warningExpiryDate?: string;
  @IsOptional() @IsString() @MaxLength(1500) requiredImprovement?: string;
  @IsOptional() @IsString() @MaxLength(1500) disciplinaryOutcome?: string;
  @IsOptional() @IsDateString() terminationDate?: string;
}

export class ExternalDocumentRecipientDto {
  @IsString() @MaxLength(100) firstName!: string;
  @IsString() @MaxLength(100) lastName!: string;
  @IsOptional() @IsEmail() @MaxLength(200) email?: string;
  @IsOptional() @Matches(/^(?:\+27|0)[6-8]\d{8}$/) phone?: string;
  @IsOptional() @Matches(/^\d{13}$/) idNumber?: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @IsString() @MaxLength(160) jobTitle?: string;
  @IsOptional() @IsString() @MaxLength(160) department?: string;
  @IsOptional() @IsNumberString() proposedSalary?: string;
  @IsOptional() @IsDateString() proposedStartDate?: string;
  @IsOptional() @IsString() candidateId?: string;
}

export class PreviewGeneratedDocumentDto {
  @IsString() templateId!: string;
  @IsOptional() @IsString() employeeId?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => ExternalDocumentRecipientDto)
  recipient?: ExternalDocumentRecipientDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => DocumentMappingOverridesDto)
  overrides?: DocumentMappingOverridesDto;
  @IsOptional() @IsString() @MaxLength(180) title?: string;
  @IsOptional() @IsDateString() effectiveDate?: string;
}

export class CreateGeneratedDocumentDto extends PreviewGeneratedDocumentDto {
  @IsOptional() @IsBoolean() visibleToEmployee?: boolean;
  @IsOptional() @IsBoolean() updateEmployeeProfile?: boolean;
  @IsOptional() @IsString() @MaxLength(120) idempotencyKey?: string;
}

export class DocumentDecisionDto {
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}

export class DocumentVisibilityDto {
  @IsBoolean() visibleToEmployee!: boolean;
}
