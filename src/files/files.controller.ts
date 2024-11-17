import {
  Get,
  Post,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  Controller,
  ParseFilePipe,
  Query,
  Res,
  FileTypeValidator,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { UploadFileDto } from './dto/create-file.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { GetFileDto } from './dto/get-one.dto';
import { Response } from 'express';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('/upload')
  @UseInterceptors(FileInterceptor('files'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          // Max size validator: 2GB (2 * 1024 * 1024 * 1024 bytes)
          new MaxFileSizeValidator({
            maxSize: 2 * 1024 * 1024 * 1024,
            message: 'The file size must not exceed 2GB',
          }),

          // File type validator: Allow specific formats
          new FileTypeValidator({
            fileType: /\.(doc|docx|jpeg|jpg|png|zip|rar|pdf|mp4|mov|avi|mkv)$/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() uploadFileDto: UploadFileDto,
  ) {
    return this.filesService.create(file, uploadFileDto);
  }

  @Get('nanoId/:nanoId')
  findByNanoId(@Param('nanoId') nanoId: string) {
    return this.filesService.findByNanoId(nanoId);
  }

  @Get('/request-file-access')
  requestFileAccess(@Query() getFileDto: GetFileDto) {
    return this.filesService.requestFileAccess(
      getFileDto.fileId,
      getFileDto.password,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.filesService.findOne(id);
  }

  @Get('/download/:id')
  async downloadFile(@Param('id') id: string, @Res() res: Response) {
    return this.filesService.downloadFile(id, res);
  }
}
