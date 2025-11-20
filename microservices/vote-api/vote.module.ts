import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VoteController } from './vote.controller';
import { VoteService } from './vote.service';
import { DatabaseModule } from '../../src/modules/database/database.module';
import { CryptoModule } from '../../src/modules/crypto/crypto.module';
import { ZKProofModule } from '../../src/modules/zkproof/zkproof.module';
import { MerkleModule } from '../../src/modules/merkle/merkle.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    CryptoModule,
    ZKProofModule,
    MerkleModule,
  ],
  controllers: [VoteController],
  providers: [VoteService],
})
export class VoteModule {}
