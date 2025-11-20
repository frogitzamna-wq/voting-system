import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CryptoService } from '../../src/modules/crypto/crypto.service';
import { ZKProofService } from '../../src/modules/zkproof/zkproof.service';
import { MerkleTreeService } from '../../src/modules/merkle/merkle.service';
import { CastVoteDto, RegisterVoterDto } from './dto';

@Injectable()
export class VoteService {
  private voters: Map<string, any> = new Map();
  private votes: Map<string, any> = new Map();
  private nullifiers: Set<string> = new Set();

  constructor(
    private readonly crypto: CryptoService,
    private readonly zkProof: ZKProofService,
    private readonly merkle: MerkleTreeService,
  ) {}

  async registerVoter(dto: RegisterVoterDto) {
    const { voterId, ballotId } = dto;

    if (this.voters.has(voterId)) {
      throw new BadRequestException('Voter already registered');
    }

    // Generate voter commitment for Merkle tree
    const commitment = this.crypto.hash(Buffer.from(voterId, 'utf8'));

    const voter = {
      id: voterId,
      ballotId,
      commitment: commitment.toString('hex'),
      registeredAt: new Date(),
      hasVoted: false,
    };

    this.voters.set(voterId, voter);

    return {
      success: true,
      voterId,
      commitment: voter.commitment,
      message: 'Voter registered successfully',
    };
  }

  async castVote(dto: CastVoteDto) {
    const { voterId, ballotId, candidateId, zkProof, publicInputs } = dto;

    // Check if voter is registered
    const voter = this.voters.get(voterId);
    if (!voter) {
      throw new NotFoundException('Voter not registered');
    }

    if (voter.hasVoted) {
      throw new BadRequestException('Voter has already cast a vote');
    }

    // Generate nullifier
    const nullifier = this.crypto.generateNullifier(
      Buffer.from(voterId, 'utf8'),
      Buffer.from(ballotId, 'utf8')
    );
    const nullifierHex = nullifier.toString('hex');

    // Check for double voting
    if (this.nullifiers.has(nullifierHex)) {
      throw new BadRequestException('Double vote detected');
    }

    // Verify ZK proof
    const proofValid = await this.zkProof.verifyProof(zkProof, publicInputs);
    if (!proofValid) {
      throw new BadRequestException('Invalid ZK proof');
    }

    // Generate vote commitment
    const voteCommitment = this.crypto.createCommitment(
      Buffer.from(candidateId, 'utf8')
    );

    const voteId = this.crypto.hash(Buffer.concat([
      nullifier,
      Buffer.from(Date.now().toString()),
    ])).toString('hex');

    const vote = {
      id: voteId,
      ballotId,
      candidateId,
      voteCommitment: voteCommitment.commitment.toString('hex'),
      nullifier: nullifierHex,
      zkProof,
      timestamp: new Date(),
      txId: null, // Will be set after blockchain submission
    };

    this.votes.set(voteId, vote);
    this.nullifiers.add(nullifierHex);
    voter.hasVoted = true;

    return {
      success: true,
      voteId,
      nullifier: nullifierHex,
      commitment: vote.voteCommitment,
      message: 'Vote cast successfully',
    };
  }

  async getVote(voteId: string) {
    const vote = this.votes.get(voteId);
    if (!vote) {
      throw new NotFoundException('Vote not found');
    }

    return {
      id: vote.id,
      ballotId: vote.ballotId,
      commitment: vote.voteCommitment,
      nullifier: vote.nullifier,
      timestamp: vote.timestamp,
      txId: vote.txId,
    };
  }

  async getProofByNullifier(nullifier: string) {
    for (const vote of this.votes.values()) {
      if (vote.nullifier === nullifier) {
        return {
          nullifier,
          zkProof: vote.zkProof,
          timestamp: vote.timestamp,
        };
      }
    }

    throw new NotFoundException('Proof not found');
  }

  async getVoterStatus(voterId: string) {
    const voter = this.voters.get(voterId);
    if (!voter) {
      throw new NotFoundException('Voter not found');
    }

    return {
      voterId: voter.id,
      ballotId: voter.ballotId,
      hasVoted: voter.hasVoted,
      registeredAt: voter.registeredAt,
    };
  }
}
