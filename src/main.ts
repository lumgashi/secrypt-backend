import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.use(helmet());
  app.useLogger(app.get(Logger));
  BigInt.prototype['toJSON'] = function () {
    const int = Number.parseInt(this.toString());
    return int ?? this.toString();
  };
  await app.listen(3000);
}
bootstrap();