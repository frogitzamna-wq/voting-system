import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { ZKProofModule } from '../../src/modules/zkproof/zkproof.module';
import { MerkleModule } from '../../src/modules/merkle/merkle.module';
import { CryptoModule } from '../../src/modules/crypto/crypto.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ZKProofModule,
    MerkleModule,
    CryptoModule,
  ],
  controllers: [VerificationController],
  providers: [VerificationService],
})
export class VerificationModule {}
