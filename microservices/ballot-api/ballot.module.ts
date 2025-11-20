import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BallotController } from './ballot.controller';
import { BallotService } from './ballot.service';
import { DatabaseModule } from '../../src/modules/database/database.module';
import { MerkleModule } from '../../src/modules/merkle/merkle.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    MerkleModule,
  ],
  controllers: [BallotController],
  providers: [BallotService],
})
export class BallotModule {}
