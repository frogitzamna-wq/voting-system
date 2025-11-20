import { Controller, Get, Param, Query } from '@nestjs/common';
import { ExplorerService } from './explorer.service';

@Controller('api/v1')
export class ExplorerController {
  constructor(private readonly explorerService: ExplorerService) {}

  @Get('audit/:ballotId')
  async auditBallot(@Param('ballotId') ballotId: string) {
    return this.explorerService.auditBallot(ballotId);
  }

  @Get('transactions/:txid')
  async getTransaction(@Param('txid') txid: string) {
    return this.explorerService.getTransaction(txid);
  }

  @Get('stats')
  async getStats() {
    return this.explorerService.getGlobalStats();
  }

  @Get('stats/:ballotId')
  async getBallotStats(@Param('ballotId') ballotId: string) {
    return this.explorerService.getBallotStats(ballotId);
  }

  @Get('verify/vote/:voteId')
  async verifyVoteOnChain(@Param('voteId') voteId: string) {
    return this.explorerService.verifyVoteOnChain(voteId);
  }

  @Get('merkle/:ballotId/proof')
  async getMerkleProof(
    @Param('ballotId') ballotId: string,
    @Query('leaf') leaf: string
  ) {
    return this.explorerService.getMerkleProof(ballotId, leaf);
  }

  @Get('health')
  async healthCheck() {
    return {
      status: 'healthy',
      service: 'explorer-api',
      timestamp: new Date().toISOString(),
      public: true,
    };
  }
}
