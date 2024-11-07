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
} from '@nestjs/common';
import { FilesService } from './files.service';
import { UploadFileDto } from './dto/create-file.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { GetFileDto } from './dto/get-one.dto';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

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
}
