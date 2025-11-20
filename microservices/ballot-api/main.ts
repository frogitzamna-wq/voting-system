import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { BallotModule } from './ballot.module';

async function bootstrap() {
  const app = await NestFactory.create(BallotModule);
  
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
  
  const port = process.env.PORT || 3101;
  await app.listen(port);
  console.log(`Ballot API listening on port ${port}`);
}

bootstrap();
