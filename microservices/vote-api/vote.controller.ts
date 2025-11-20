import { Controller, Post, Get, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { VoteService } from './vote.service';
import { CastVoteDto, RegisterVoterDto } from './dto';

@Controller('api/v1')
export class VoteController {
  constructor(private readonly voteService: VoteService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async registerVoter(@Body() dto: RegisterVoterDto) {
    return this.voteService.registerVoter(dto);
  }

  @Post('votes')
  @HttpCode(HttpStatus.CREATED)
  async castVote(@Body() dto: CastVoteDto) {
    return this.voteService.castVote(dto);
  }

  @Get('votes/:id')
  async getVote(@Param('id') id: string) {
    return this.voteService.getVote(id);
  }

  @Get('proofs/:nullifier')
  async getProof(@Param('nullifier') nullifier: string) {
    return this.voteService.getProofByNullifier(nullifier);
  }

  @Get('voter/:voterId')
  async getVoterStatus(@Param('voterId') voterId: string) {
    return this.voteService.getVoterStatus(voterId);
  }

  @Get('health')
  async healthCheck() {
    return {
      status: 'healthy',
      service: 'vote-api',
      timestamp: new Date().toISOString(),
    };
  }
}
