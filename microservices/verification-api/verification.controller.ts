import { Controller, Post, Get, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { VerifyVoteDto } from './dto';

@Controller('api/v1')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verifyVote(@Body() dto: VerifyVoteDto) {
    return this.verificationService.verifyVote(dto);
  }

  @Get('tally/:ballotId')
  async getTally(@Param('ballotId') ballotId: string) {
    return this.verificationService.getTally(ballotId);
  }

  @Get('nullifiers/check')
  async checkNullifier(@Query('nullifier') nullifier: string) {
    return this.verificationService.checkNullifier(nullifier);
  }

  @Get('merkle/:ballotId/root')
  async getMerkleRoot(@Param('ballotId') ballotId: string) {
    return this.verificationService.getMerkleRoot(ballotId);
  }

  @Get('health')
  async healthCheck() {
    return {
      status: 'healthy',
      service: 'verification-api',
      timestamp: new Date().toISOString(),
    };
  }
}
