import { MediaType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class UploadFileDto {
  @IsEnum(MediaType)
  fileType: MediaType;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(3)
  @Max(50)
  maxDownloads?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(120000) // Minimum of 1 minute in milliseconds
  @Max(86400000) // Maximum of 1 day in milliseconds
  ttl?: number;

  @IsOptional()
  @IsString()
  password?: string;
}
