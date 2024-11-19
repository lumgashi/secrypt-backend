import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UploadFileDto } from './dto/create-file.dto';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ObjectCannedACL,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { nanoid } from 'nanoid';
import { matchPassword } from 'src/utils/matchPassword';
import { File } from '@prisma/client';
import { convertFileSize } from 'src/utils/convertFileSize';
import { Response } from 'express';
import * as mime from 'mime-types';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class FilesService {
  private readonly s3Client = new S3Client({
    credentials: {
      accessKeyId: this.config.get('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.config.get('AWS_SECRET_ACCESS_KEY'),
    },
    region: this.config.get('AWS_REGION'),
  });

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}
  async create(file: Express.Multer.File, uploadFileDto: UploadFileDto) {
    const fileSize = convertFileSize(file.size);
    //const { fileType, maxDownloads, ttl } = uploadFileDto;
    let hashedPassword: string | null = null;
    try {
      const command = new PutObjectCommand({
        Bucket: this.config.get('AWS_BUCKET_NAME'),
        Key: file.originalname,
        Body: file.buffer,
        ACL: ObjectCannedACL.public_read,
        ContentDisposition: 'inline',
      });

      await this.s3Client.send(command);
      if (uploadFileDto?.password) {
        hashedPassword = await argon2.hash(uploadFileDto.password);
      }

      const urlID = nanoid();
      const newFile = await this.prisma.file.create({
        data: {
          nanoID: urlID,
          fileName: file.originalname,
          fileType: uploadFileDto.fileType,
          fileSize: fileSize,
          s3Key: file.originalname,
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
    const data = {
      downloadCount: file.downloadCount,
      ttl: file.ttl,
      uploadedAt: file.uploadedAt,
      fileType: file.fileType,
      fileSize: file.fileSize,
      maxDownloads: file.maxDownloads,
      fileName: file.fileName,
      fileId: file.id,
    };

    return data;
  }

  async downloadFile(fileId: string, res: Response): Promise<void> {
    try {
      const file = await this.prisma.file.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        throw new NotFoundException('File does not exist');
      }
      if (!file.fileName) {
        throw new Error('File name is missing in the database');
      }

      // Determine MIME type
      const mimeType =
        mime?.lookup(file.fileName) || 'application/octet-stream';

      // Use the s3Key from the file metadata to get the file from S3
      const command = new GetObjectCommand({
        Bucket: this.config.get('AWS_BUCKET_NAME'),
        Key: file.s3Key,
      });

      let s3Response;
      try {
        s3Response = await this.s3Client.send(command);
      } catch (err) {
        console.error('Error retrieving file from S3:', err.message);
        res
          .status(500)
          .send('Internal Server Error while downloading the file');
        return;
      }

      // Check if the response Body exists
      if (!s3Response.Body) {
        throw new Error('No data found in S3 object');
      }

      // Step 5: Set headers for file download
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${file.fileName}"`,
      );
      res.setHeader('Content-Type', mimeType);

      // Update file metadata in the database
      const isExpired = file.downloadCount - 1 === 0;
      await this.prisma.file.update({
        where: {
          id: file.id,
        },
        data: {
          downloadCount: { decrement: 1 },
          isExpired,
        },
      });

      // Step 6: Stream the file to the client
      const s3Stream = s3Response.Body as NodeJS.ReadableStream;
      s3Stream.pipe(res);

      // Handle stream errors
      s3Stream.on('error', (err) => {
        console.error('Error streaming file from S3:', err.message);
        res.status(500).send('Internal Server Error while streaming the file');
      });
    } catch (error) {
      throw new InternalServerErrorException('Could not download file', error);
    }
  }

  private isFileExpired(file: File): boolean {
    const currentTime = new Date(Date.now());
    const currentTimeinMiliseconds = currentTime.getTime(); // Current time as bigint
    const expirationTime = BigInt(file.uploadedAt.getTime()) + BigInt(file.ttl); // Expiration time as bigint

    return currentTimeinMiliseconds > expirationTime;
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async deleteExpiredFiles() {
    const currentTime = new Date(Date.now());
    const currentTimeinMiliseconds = currentTime.getTime();
    // Step 1: Fetch files that might need deletion based on initial conditions
    const files = await this.prisma.file.findMany({
      where: {
        OR: [
          { isExpired: true },
          { downloadCount: 0 },
          { ttl: { lt: currentTimeinMiliseconds } },
        ],
      },
    });

    // Step 4: Delete the files
    for (const file of files) {
      try {
        // Create and send DeleteObjectCommand
        const command = new DeleteObjectCommand({
          Bucket: this.config.get('AWS_BUCKET_NAME'),
          Key: file.s3Key,
        });

        await this.s3Client.send(command);

        console.log(
          `Successfully deleted file: ${file.fileName} from S3 and database.`,
        );
      } catch (error) {
        console.error(
          `Failed to delete file: ${file.fileName}. Error: ${error.message}`,
        );
      }
    }
  }
}
