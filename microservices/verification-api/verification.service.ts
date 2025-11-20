import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ZKProofService } from '../../src/modules/zkproof/zkproof.service';
import { MerkleTreeService } from '../../src/modules/merkle/merkle.service';
import { CryptoService } from '../../src/modules/crypto/crypto.service';
import { VerifyVoteDto } from './dto';

@Injectable()
export class VerificationService {
  private nullifiers: Set<string> = new Set();
  private votes: Map<string, any> = new Map(); // ballotId -> votes[]
  private merkleRoots: Map<string, string> = new Map(); // ballotId -> root

  constructor(
    private readonly zkProof: ZKProofService,
    private readonly merkle: MerkleTreeService,
    private readonly crypto: CryptoService,
  ) {}

  async verifyVote(dto: VerifyVoteDto) {
    const { voteId, zkProof, publicInputs, nullifier } = dto;

    // Verify ZK proof
    const proofValid = await this.zkProof.verifyProof(zkProof, publicInputs);
    if (!proofValid) {
      return {
        valid: false,
        voteId,
        reason: 'Invalid ZK proof',
      };
    }

    // Check nullifier hasn't been used
    if (this.nullifiers.has(nullifier)) {
      return {
        valid: false,
        voteId,
        reason: 'Nullifier already used (double vote)',
      };
    }

    return {
      valid: true,
      voteId,
      nullifier,
      verifiedAt: new Date(),
    };
  }

  async getTally(ballotId: string) {
    const votes = this.votes.get(ballotId);
    if (!votes) {
      return {
        ballotId,
        totalVotes: 0,
        results: {},
        message: 'No votes recorded for this ballot',
      };
    }

    // Tally votes by candidate
    const tally: Record<string, number> = {};
    for (const vote of votes) {
      const candidateId = vote.candidateId;
      tally[candidateId] = (tally[candidateId] || 0) + 1;
    }

    return {
      ballotId,
      totalVotes: votes.length,
      results: tally,
      tallyGeneratedAt: new Date(),
    };
  }

  async checkNullifier(nullifier: string) {
    const exists = this.nullifiers.has(nullifier);
    return {
      nullifier,
      exists,
      message: exists ? 'Nullifier has been used' : 'Nullifier is available',
    };
  }

  async getMerkleRoot(ballotId: string) {
    const root = this.merkleRoots.get(ballotId);
    if (!root) {
      throw new NotFoundException('Merkle root not found for ballot');
    }

    return {
      ballotId,
      merkleRoot: root,
    };
  }

  // Internal methods for vote registration
  async registerVote(ballotId: string, vote: any) {
    const ballotVotes = this.votes.get(ballotId) || [];
    ballotVotes.push(vote);
    this.votes.set(ballotId, ballotVotes);
    this.nullifiers.add(vote.nullifier);
  }

  async setMerkleRoot(ballotId: string, root: string) {
    this.merkleRoots.set(ballotId, root);
  }
}
