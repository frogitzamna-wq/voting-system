import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ExplorerController } from './explorer.controller';
import { ExplorerService } from './explorer.service';
import { MerkleModule } from '../../src/modules/merkle/merkle.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MerkleModule,
  ],
  controllers: [ExplorerController],
  providers: [ExplorerService],
})
export class ExplorerModule {}
