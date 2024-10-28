import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UploadFileDto } from './dto/create-file.dto';
import { ConfigService } from '@nestjs/config';
import { S3 } from 'aws-sdk';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { nanoid } from 'nanoid';
import { GetFileDto } from './dto/get-one.dto';
import { matchPassword } from 'src/utils/matchPassword';
import { File } from '@prisma/client';

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
    console.log('filee:', file);
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

  async findByNanoId(nanoId: string) {
    console.log('nanoId::', nanoId);
    const fileExists = await this.prisma.file.findUnique({
      where: {
        nanoID: nanoId,
      },
      select: {
        ttl: true,
        id: true,
        passwordHash: true,
      },
    });

    if (!fileExists) {
      throw new NotFoundException('File does not exist');
    }
    fileExists['hasPassword'] = !!fileExists.passwordHash;
    delete fileExists['passwordHash'];
    return fileExists;
  }

  async findOne(id: string) {
    console.log('id::', id);
    const fileExists = await this.prisma.file.findUnique({
      where: {
        id,
      },
    });

    if (!fileExists) {
      throw new NotFoundException('File does not exist');
    }

    return fileExists;
  }

  async requestFileAccess(fileId: string, password: string): Promise<string> {
    console.log('fileId::', fileId);
    const file = await this.findOne(fileId);

    // Check expiration
    const hasFileTimeExpired = this.isFileExpired(file);
    if (hasFileTimeExpired) throw new BadRequestException('File link expired');

    // Check password
    const isPasswordMatched = await matchPassword(file.passwordHash, password);
    if (!isPasswordMatched) {
      throw new UnauthorizedException('Incorrect password');
    }

    // Check download limit
    if (file.downloadCount <= 0 || file.isExpired) {
      throw new NotFoundException('Download limit reached or has expired');
    }
    const isExpired = file.downloadCount - 1 === 0 ? true : false;
    await this.prisma.file.update({
      where: {
        id: file.id,
      },
      data: {
        downloadCount: file.downloadCount - 1,
        isExpired,
      },
    });

    // If everything is valid, generate a pre-signed URL
    return this.generatePresignedUrl(file);
  }

  private generatePresignedUrl(file: File): string {
    return this.s3Client.getSignedUrl('getObject', {
      Bucket: this.config.get('AWS_BUCKET_NAME'),
      Key: file.s3Key,
      // calculate the remaining time in minutes
      Expires: this.calculateRemainingTimeInMinutes(file) * 60,
    });
  }

  private isFileExpired(file: File): boolean {
    const currentTime = new Date(Date.now());
    const currentTimeinMiliseconds = currentTime.getTime(); // Current time as bigint
    const expirationTime = BigInt(file.uploadedAt.getTime()) + BigInt(file.ttl); // Expiration time as bigint

    return currentTimeinMiliseconds > expirationTime;
  }

  // what this function does it to calculate the remaining time in minutes to pass to the Expires property of the pre-signed URL 
  private calculateRemainingTimeInMinutes(file: File): number {
    const currentTime = BigInt(Date.now()); // Current time as bigint in miliseconds
    const expirationTime = BigInt(file.uploadedAt.getTime()) + file.ttl; // Expiration time as bigint in miliseconds

    const remainingTime = expirationTime - currentTime; // Remaining time in milliseconds as bigint

    // Ensure remaining time is non-negative and convert to minutes
    const remainingMinutes =
      remainingTime > 0n ? Number(remainingTime / 60000n) : 0;
    return remainingMinutes; // Return the remaining time in minutes as a number
  }
}
