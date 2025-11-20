import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { MerkleTreeService } from '../../src/modules/merkle/merkle.service';
import { CreateBallotDto, CreateCandidateDto } from './dto';

enum BallotStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  CLOSED = 'closed',
  TALLIED = 'tallied',
}

@Injectable()
export class BallotService {
  private ballots: Map<string, any> = new Map();
  private candidates: Map<string, any[]> = new Map();

  constructor(private readonly merkle: MerkleTreeService) {}

  async createBallot(dto: CreateBallotDto) {
    const ballotId = this.generateId();

    const ballot = {
      id: ballotId,
      title: dto.title,
      description: dto.description,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      status: BallotStatus.DRAFT,
      createdAt: new Date(),
      merkleRoot: null,
      totalVotes: 0,
    };

    this.ballots.set(ballotId, ballot);
    this.candidates.set(ballotId, []);

    return {
      success: true,
      ballotId,
      ballot,
      message: 'Ballot created successfully',
    };
  }

  async getBallots(status?: string) {
    const allBallots = Array.from(this.ballots.values());

    if (status) {
      return allBallots.filter(b => b.status === status);
    }

    return allBallots;
  }

  async getBallot(ballotId: string) {
    const ballot = this.ballots.get(ballotId);
    if (!ballot) {
      throw new NotFoundException('Ballot not found');
    }

    const candidates = this.candidates.get(ballotId) || [];

    return {
      ...ballot,
      candidates,
    };
  }

  async updateBallotStatus(ballotId: string, status: string) {
    const ballot = this.ballots.get(ballotId);
    if (!ballot) {
      throw new NotFoundException('Ballot not found');
    }

    // Validate status transition
    if (!Object.values(BallotStatus).includes(status as BallotStatus)) {
      throw new BadRequestException('Invalid ballot status');
    }

    // State machine validation
    const currentStatus = ballot.status;
    const validTransitions: Record<string, string[]> = {
      draft: ['active'],
      active: ['closed'],
      closed: ['tallied'],
      tallied: [],
    };

    if (!validTransitions[currentStatus]?.includes(status)) {
      throw new BadRequestException(
        `Invalid transition from ${currentStatus} to ${status}`
      );
    }

    ballot.status = status;
    ballot.updatedAt = new Date();

    // If activating, generate Merkle root
    if (status === BallotStatus.ACTIVE && !ballot.merkleRoot) {
      const candidates = this.candidates.get(ballotId) || [];
      if (candidates.length === 0) {
        throw new BadRequestException('Cannot activate ballot without candidates');
      }
      // In production, this would build Merkle tree of eligible voters
      ballot.merkleRoot = this.generateId();
    }

    return {
      success: true,
      ballotId,
      status: ballot.status,
      message: `Ballot status updated to ${status}`,
    };
  }

  async addCandidate(ballotId: string, dto: CreateCandidateDto) {
    const ballot = this.ballots.get(ballotId);
    if (!ballot) {
      throw new NotFoundException('Ballot not found');
    }

    if (ballot.status !== BallotStatus.DRAFT) {
      throw new BadRequestException('Cannot add candidates to non-draft ballot');
    }

    const candidateId = this.generateId();
    const candidate = {
      id: candidateId,
      name: dto.name,
      description: dto.description,
      metadata: dto.metadata,
      addedAt: new Date(),
    };

    const ballotCandidates = this.candidates.get(ballotId) || [];
    ballotCandidates.push(candidate);
    this.candidates.set(ballotId, ballotCandidates);

    return {
      success: true,
      candidateId,
      candidate,
      message: 'Candidate added successfully',
    };
  }

  async getCandidates(ballotId: string) {
    const ballot = this.ballots.get(ballotId);
    if (!ballot) {
      throw new NotFoundException('Ballot not found');
    }

    return this.candidates.get(ballotId) || [];
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
