import {
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  Controller,
  ParseFilePipe,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { UploadFileDto } from './dto/create-file.dto';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get()
  findAll() {
    return this.filesService.findAll();
  }

  @Post('/upload')
  @UseInterceptors(FileInterceptor('files'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          // new MaxFileSizeValidator({ maxSize: 1000 }),
          // new FileTypeValidator({ fileType: 'image/jpeg' }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() uploadFileDto: UploadFileDto, // Bind the DTO separately
  ) {
    console.log('uploadFileDto', uploadFileDto);
    return this.filesService.create(file, uploadFileDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.filesService.findOne(id);
  }
}