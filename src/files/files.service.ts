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
import { matchPassword } from 'src/utils/matchPassword';
import { File } from '@prisma/client';
import { convertFileSize } from 'src/utils/convertFileSize';
import { Response } from 'express';

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
    const fileSize = convertFileSize(file.size);
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
        hashedPassword = await argon2.hash(uploadFileDto.password);
      }

      const urlID = nanoid();
      // Save file metadata to the database
      const newFile = await this.prisma.file.create({
        data: {
          nanoID: urlID,
          fileName: file.originalname,
          fileType: uploadFileDto.fileType,
          fileSize: fileSize,
          s3Key: uploadedFile.Key,
          maxDownloads: uploadFileDto.maxDownloads,
          downloadCount: uploadFileDto.maxDownloads,
          ttl: uploadFileDto.ttl,
          passwordHash: hashedPassword,
        },
      });
      const generatedUrl = `${this.config.get('baseURL')}/${newFile.nanoID}`;
      return generatedUrl;
    } catch (error) {
      throw new InternalServerErrorException('Could not upload file', error);
    }
  }

  async findByNanoId(nanoId: string) {
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
    try {
      const fileExists = await this.prisma.file.findUnique({
        where: {
          id,
        },
      });

      if (!fileExists) {
        throw new NotFoundException('File does not exist');
      }

      return fileExists;
    } catch (error) {
      throw new InternalServerErrorException('Could not get file', error);
    }
  }

  async requestFileAccess(fileId: string, password: string) {
    const file = await this.findOne(fileId);

    // Check expiration
    const hasFileTimeExpired = this.isFileExpired(file);
    if (hasFileTimeExpired) throw new BadRequestException('File link expired');

    // Check password
    if (file.passwordHash !== null) {
      const isPasswordMatched = await matchPassword(
        file.passwordHash,
        password,
      );
      if (!isPasswordMatched) {
        throw new UnauthorizedException('Incorrect password');
      }
    }

    // Check download limit
    if (file.downloadCount <= 0 || file.isExpired) {
      throw new NotFoundException('Download limit reached or has expired');
    }

    if (file.downloadCount === 0) {
      throw new BadRequestException('Download limit reached');
    }

    // const isExpired = file.downloadCount - 1 === 0 ? true : false;
    // await this.prisma.file.update({
    //   where: {
    //     id: file.id,
    //   },
    //   data: {
    //     downloadCount: file.downloadCount - 1,
    //     isExpired,
    //   },
    // });
    const data = {
      downloadCount: file.downloadCount,
      ttl: file.ttl,
      uploadedAt: file.uploadedAt,
      fileType: file.fileType,
      fileSize: file.fileSize,
      maxDownloads: file.maxDownloads,
      fileName: file.fileName,
    };
    // If everything is valid, generate a pre-signed URL
    return data;
  }

  async downloadFile(fileId: string, res: Response): Promise<void> {
    // Step 1: Fetch file metadata from the database
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('File does not exist');
    }

    // Step 2: Use the s3Key from the file metadata to get the file from S3
    const s3Stream = this.s3Client
      .getObject({
        Bucket: this.config.get('AWS_BUCKET_NAME'),
        Key: file.s3Key,
      })
      .createReadStream();

    // Step 3: Set headers for file download in the response
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );
    const mimeType = `${file}`.split('.')[1];
    res.setHeader('Content-Type', mimeType);

    // Step 4: Stream the file to the client
    s3Stream.pipe(res);
  }

  private generatePresignedUrl(file: File): any {
    const url = this.s3Client.getSignedUrl('getObject', {
      Bucket: this.config.get('AWS_BUCKET_NAME'),
      Key: file.s3Key,
      // calculate the remaining time in minutes
      Expires: this.calculateRemainingTimeInMinutes(file) * 60,
    });

    // Return as a JSON object with a defined key
    return { presignedUrl: url };
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
