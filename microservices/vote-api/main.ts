import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { VoteModule } from './vote.module';

async function bootstrap() {
  const app = await NestFactory.create(VoteModule);
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  });
  
  const port = process.env.PORT || 3100;
  await app.listen(port);
  console.log(`Vote API listening on port ${port}`);
}

bootstrap();
