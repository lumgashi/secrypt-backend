import { IsString } from 'class-validator';

export class GetFileDto {
  @IsString()
  password: string;

  @IsString()
  fileId: string;
}
