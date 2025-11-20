import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { VerificationModule } from './verification.module';

async function bootstrap() {
  const app = await NestFactory.create(VerificationModule);
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    credentials: true,
  });
  
  const port = process.env.PORT || 3102;
  await app.listen(port);
  console.log(`Verification API listening on port ${port}`);
}

bootstrap();
