import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { UploadFileDto } from './dto/create-file.dto';
import { ConfigService } from '@nestjs/config';
import { S3 } from 'aws-sdk';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { nanoid } from 'nanoid';

@Injectable()
export class FilesService {
  private readonly s3Client = new S3({
    accessKeyId: this.config.get('AWS_ACCESS_KEY_ID'),
    secretAccessKey: this.config.get('AWS_SECRET_ACCESS_KEY'),
  });
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}
  async create(file: Express.Multer.File, uploadFileDto: UploadFileDto) {
    //console.log('hereeee', uploadFileDto?.fileType)
    console.log('hereeee', uploadFileDto);
    console.log('filee:',file)
    //const { fileType, maxDownloads, ttl } = uploadFileDto;
    let hashedPassword: string | null = null;
    let uploadedFile: any = null;
    try {
      uploadedFile = await this.s3Client
        .upload({
          Bucket: this.config.get('AWS_BUCKET_NAME'),
          Body: file.buffer,
          Key: file.originalname,
          ACL: 'public-read',
          ContentDisposition: 'inline',
        })
        .promise();

      if (uploadFileDto?.password) {
      }
      hashedPassword = await argon2.hash('1234');

      console.log('uploadedFile::', uploadedFile);

      const urlID = nanoid();
      // Save file metadata to the database
      const newFile = await this.prisma.file.create({
        data: {
          nanoID: urlID,
          fileName: file.originalname,
          fileType: uploadFileDto.fileType,
          fileSize: file.size,
          s3Key: uploadedFile.Key,
          maxDownloads: uploadFileDto.maxDownloads,
          downloadCount: uploadFileDto.maxDownloads,
          ttl: uploadFileDto.ttl,
          passwordHash: hashedPassword,
        },
      });
      console.log('newFile::', newFile);
      const generatedUrl = `${this.config.get('baseURL')}/${newFile.nanoID}`;
      return newFile;
    } catch (error) {
      console.log('error::', error);
      throw new InternalServerErrorException('Could not upload file', error);
    }
  }

  findAll() {
    return `This action returns all files`;
  }

  findOne(id: string) {
    return `This action returns a #${id} file`;
  }
}
