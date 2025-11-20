import { NestFactory } from '@nestjs/core';
import { ExplorerModule } from './explorer.module';

async function bootstrap() {
  const app = await NestFactory.create(ExplorerModule);
  
  app.enableCors({
    origin: '*', // Public API - allow all origins
    methods: ['GET'],
    credentials: false,
  });
  
  const port = process.env.PORT || 3103;
  await app.listen(port);
  console.log(`Explorer API (Public Audit) listening on port ${port}`);
}

bootstrap();
