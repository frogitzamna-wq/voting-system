import { Injectable, NotFoundException } from '@nestjs/common';
import { MerkleTreeService } from '../../src/modules/merkle/merkle.service';

@Injectable()
export class ExplorerService {
  private ballots: Map<string, any> = new Map();
  private transactions: Map<string, any> = new Map();
  private votes: Map<string, any> = new Map();

  constructor(private readonly merkle: MerkleTreeService) {
    // Initialize with mock data for demonstration
    this.initializeMockData();
  }

  async auditBallot(ballotId: string) {
    const ballot = this.ballots.get(ballotId);
    if (!ballot) {
      throw new NotFoundException('Ballot not found');
    }

    const votes = Array.from(this.votes.values()).filter(
      v => v.ballotId === ballotId
    );

    return {
      ballotId,
      title: ballot.title,
      status: ballot.status,
      merkleRoot: ballot.merkleRoot,
      totalVotes: votes.length,
      votes: votes.map(v => ({
        voteId: v.id,
        timestamp: v.timestamp,
        commitment: v.commitment,
        nullifier: v.nullifier,
        txId: v.txId,
        verified: true,
      })),
      auditTimestamp: new Date(),
    };
  }

  async getTransaction(txid: string) {
    const tx = this.transactions.get(txid);
    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    return {
      txId: tx.id,
      type: tx.type,
      ballotId: tx.ballotId,
      timestamp: tx.timestamp,
      blockHeight: tx.blockHeight,
      confirmations: tx.confirmations,
      data: tx.data,
    };
  }

  async getGlobalStats() {
    const totalBallots = this.ballots.size;
    const totalVotes = this.votes.size;
    const totalTransactions = this.transactions.size;

    const activeBallots = Array.from(this.ballots.values()).filter(
      b => b.status === 'active'
    ).length;

    return {
      totalBallots,
      activeBallots,
      totalVotes,
      totalTransactions,
      uptime: process.uptime(),
      timestamp: new Date(),
    };
  }

  async getBallotStats(ballotId: string) {
    const ballot = this.ballots.get(ballotId);
    if (!ballot) {
      throw new NotFoundException('Ballot not found');
    }

    const votes = Array.from(this.votes.values()).filter(
      v => v.ballotId === ballotId
    );

    const votesByHour = this.groupVotesByHour(votes);

    return {
      ballotId,
      title: ballot.title,
      status: ballot.status,
      totalVotes: votes.length,
      uniqueVoters: new Set(votes.map(v => v.nullifier)).size,
      votesByHour,
      firstVote: votes[0]?.timestamp,
      lastVote: votes[votes.length - 1]?.timestamp,
    };
  }

  async verifyVoteOnChain(voteId: string) {
    const vote = this.votes.get(voteId);
    if (!vote) {
      throw new NotFoundException('Vote not found');
    }

    // In production, this would query BSV blockchain
    return {
      voteId,
      onChain: true,
      txId: vote.txId,
      blockHeight: vote.blockHeight,
      confirmations: vote.confirmations || 6,
      merkleProofValid: true,
      zkProofValid: true,
      verifiedAt: new Date(),
    };
  }

  async getMerkleProof(ballotId: string, leaf: string) {
    const ballot = this.ballots.get(ballotId);
    if (!ballot) {
      throw new NotFoundException('Ballot not found');
    }

    // In production, this would generate actual Merkle proof
    return {
      ballotId,
      leaf,
      root: ballot.merkleRoot,
      proof: ['0x123...', '0x456...'], // Mock proof
      verified: true,
    };
  }

  private groupVotesByHour(votes: any[]) {
    const byHour: Record<string, number> = {};
    
    for (const vote of votes) {
      const hour = new Date(vote.timestamp).toISOString().slice(0, 13);
      byHour[hour] = (byHour[hour] || 0) + 1;
    }

    return byHour;
  }

  private initializeMockData() {
    // Mock ballot
    this.ballots.set('ballot-1', {
      id: 'ballot-1',
      title: 'Test Election 2025',
      status: 'active',
      merkleRoot: '0xabc123...',
      createdAt: new Date(),
    });

    // Mock votes
    for (let i = 0; i < 50; i++) {
      const voteId = `vote-${i}`;
      this.votes.set(voteId, {
        id: voteId,
        ballotId: 'ballot-1',
        commitment: `0x${i}abc...`,
        nullifier: `0x${i}def...`,
        txId: `tx-${i}`,
        timestamp: new Date(Date.now() - i * 60000),
        blockHeight: 800000 + i,
        confirmations: 6,
      });

      this.transactions.set(`tx-${i}`, {
        id: `tx-${i}`,
        type: 'vote',
        ballotId: 'ballot-1',
        timestamp: new Date(Date.now() - i * 60000),
        blockHeight: 800000 + i,
        confirmations: 6,
        data: { voteId },
      });
    }
  }
}
