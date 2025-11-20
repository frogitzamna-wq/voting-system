import { Controller, Post, Get, Put, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { BallotService } from './ballot.service';
import { CreateBallotDto, CreateCandidateDto, UpdateBallotStatusDto } from './dto';

@Controller('api/v1')
export class BallotController {
  constructor(private readonly ballotService: BallotService) {}

  @Post('ballots')
  @HttpCode(HttpStatus.CREATED)
  async createBallot(@Body() dto: CreateBallotDto) {
    return this.ballotService.createBallot(dto);
  }

  @Get('ballots')
  async getBallots(@Query('status') status?: string) {
    return this.ballotService.getBallots(status);
  }

  @Get('ballots/:id')
  async getBallot(@Param('id') id: string) {
    return this.ballotService.getBallot(id);
  }

  @Put('ballots/:id/status')
  async updateBallotStatus(
    @Param('id') id: string,
    @Body() dto: UpdateBallotStatusDto
  ) {
    return this.ballotService.updateBallotStatus(id, dto.status);
  }

  @Post('ballots/:ballotId/candidates')
  @HttpCode(HttpStatus.CREATED)
  async addCandidate(
    @Param('ballotId') ballotId: string,
    @Body() dto: CreateCandidateDto
  ) {
    return this.ballotService.addCandidate(ballotId, dto);
  }

  @Get('ballots/:ballotId/candidates')
  async getCandidates(@Param('ballotId') ballotId: string) {
    return this.ballotService.getCandidates(ballotId);
  }

  @Get('health')
  async healthCheck() {
    return {
      status: 'healthy',
      service: 'ballot-api',
      timestamp: new Date().toISOString(),
    };
  }
}
