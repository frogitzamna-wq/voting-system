/**
 * Quadratic Voting Module
 * 
 * Enables voters to express intensity of preferences using voice credits.
 * Cost to cast N votes = N² credits
 * 
 * Example:
 * - 1 vote costs 1 credit
 * - 2 votes cost 4 credits
 * - 3 votes cost 9 credits
 * - 10 votes cost 100 credits
 * 
 * This prevents vote buying and allows nuanced preference expression
 */

export interface VoiceCredit {
  voterId: string
  initialCredits: number
  remainingCredits: number
  spentCredits: number
}

export interface QuadraticVote {
  candidateId: number
  votes: number              // Number of votes allocated
  creditsCost: number        // Credits spent (votes²)
}

export interface QuadraticBallot {
  voterId: string
  votes: Map<number, QuadraticVote>  // candidateId -> vote allocation
  totalVotes: number
  totalCredits: number
}

/**
 * Quadratic Voting System
 */
export class QuadraticVotingSystem {
  private voiceCredits: Map<string, VoiceCredit>
  private ballots: Map<string, QuadraticBallot>
  private candidateVotes: Map<number, number>  // candidateId -> total votes
  private defaultCredits: number
  
  constructor(defaultCredits: number = 100) {
    this.voiceCredits = new Map()
    this.ballots = new Map()
    this.candidateVotes = new Map()
    this.defaultCredits = defaultCredits
  }
  
  /**
   * Initialize voice credits for a voter
   */
  initializeVoter(voterId: string, credits?: number): VoiceCredit {
    const voiceCredit: VoiceCredit = {
      voterId,
      initialCredits: credits || this.defaultCredits,
      remainingCredits: credits || this.defaultCredits,
      spentCredits: 0
    }
    
    this.voiceCredits.set(voterId, voiceCredit)
    return voiceCredit
  }
  
  /**
   * Calculate cost for N votes (N²)
   */
  static calculateCost(votes: number): number {
    return votes * votes
  }
  
  /**
   * Calculate maximum votes possible with given credits
   * maxVotes = floor(sqrt(credits))
   */
  static calculateMaxVotes(credits: number): number {
    return Math.floor(Math.sqrt(credits))
  }
  
  /**
   * Allocate votes to a candidate
   */
  allocateVotes(
    voterId: string,
    candidateId: number,
    votes: number
  ): { success: boolean; message: string } {
    // Get or initialize voter credits
    let voiceCredit = this.voiceCredits.get(voterId)
    if (!voiceCredit) {
      voiceCredit = this.initializeVoter(voterId)
    }
    
    // Get or create ballot
    let ballot = this.ballots.get(voterId)
    if (!ballot) {
      ballot = {
        voterId,
        votes: new Map(),
        totalVotes: 0,
        totalCredits: 0
      }
      this.ballots.set(voterId, ballot)
    }
    
    // Calculate cost
    const cost = QuadraticVotingSystem.calculateCost(Math.abs(votes))
    
    // Check if voter has previous allocation for this candidate
    const previousVote = ballot.votes.get(candidateId)
    const previousCost = previousVote ? previousVote.creditsCost : 0
    
    // Calculate net cost change
    const netCostChange = cost - previousCost
    
    // Check if voter has enough credits
    if (netCostChange > voiceCredit.remainingCredits) {
      return {
        success: false,
        message: `Insufficient credits. Need ${netCostChange}, have ${voiceCredit.remainingCredits}`
      }
    }
    
    // Update voice credits
    voiceCredit.remainingCredits -= netCostChange
    voiceCredit.spentCredits += netCostChange
    
    // Update ballot
    const quadraticVote: QuadraticVote = {
      candidateId,
      votes,
      creditsCost: cost
    }
    
    ballot.votes.set(candidateId, quadraticVote)
    ballot.totalVotes = Array.from(ballot.votes.values())
      .reduce((sum, v) => sum + Math.abs(v.votes), 0)
    ballot.totalCredits = Array.from(ballot.votes.values())
      .reduce((sum, v) => sum + v.creditsCost, 0)
    
    // Update candidate totals
    const currentTotal = this.candidateVotes.get(candidateId) || 0
    const previousVotes = previousVote ? previousVote.votes : 0
    this.candidateVotes.set(candidateId, currentTotal - previousVotes + votes)
    
    return {
      success: true,
      message: `Allocated ${votes} votes to candidate ${candidateId} for ${cost} credits`
    }
  }
  
  /**
   * Remove vote allocation from a candidate
   */
  removeVotes(voterId: string, candidateId: number): boolean {
    const ballot = this.ballots.get(voterId)
    if (!ballot) {
      return false
    }
    
    const vote = ballot.votes.get(candidateId)
    if (!vote) {
      return false
    }
    
    // Refund credits
    const voiceCredit = this.voiceCredits.get(voterId)!
    voiceCredit.remainingCredits += vote.creditsCost
    voiceCredit.spentCredits -= vote.creditsCost
    
    // Update candidate totals
    const currentTotal = this.candidateVotes.get(candidateId) || 0
    this.candidateVotes.set(candidateId, currentTotal - vote.votes)
    
    // Remove from ballot
    ballot.votes.delete(candidateId)
    ballot.totalVotes -= Math.abs(vote.votes)
    ballot.totalCredits -= vote.creditsCost
    
    return true
  }
  
  /**
   * Get ballot for a voter
   */
  getBallot(voterId: string): QuadraticBallot | null {
    return this.ballots.get(voterId) || null
  }
  
  /**
   * Get voice credits for a voter
   */
  getVoiceCredits(voterId: string): VoiceCredit | null {
    return this.voiceCredits.get(voterId) || null
  }
  
  /**
   * Get results with quadratic tallying
   */
  getResults(): Map<number, number> {
    return new Map(this.candidateVotes)
  }
  
  /**
   * Get detailed results with voter breakdown
   */
  getDetailedResults(): {
    candidateId: number
    totalVotes: number
    voterCount: number
    averageVotesPerVoter: number
  }[] {
    const results: Map<number, { total: number; voters: Set<string> }> = new Map()
    
    this.ballots.forEach((ballot, voterId) => {
      ballot.votes.forEach((vote, candidateId) => {
        if (!results.has(candidateId)) {
          results.set(candidateId, { total: 0, voters: new Set() })
        }
        const result = results.get(candidateId)!
        result.total += vote.votes
        result.voters.add(voterId)
      })
    })
    
    return Array.from(results.entries()).map(([candidateId, data]) => ({
      candidateId,
      totalVotes: data.total,
      voterCount: data.voters.size,
      averageVotesPerVoter: data.total / data.voters.size
    }))
  }
  
  /**
   * Get statistics
   */
  getStats(): {
    totalVoters: number
    totalCreditsIssued: number
    totalCreditsSpent: number
    totalCreditsRemaining: number
    averageCreditsSpent: number
    totalVotesCast: number
    participationRate: number
  } {
    let totalCreditsIssued = 0
    let totalCreditsSpent = 0
    let totalCreditsRemaining = 0
    let totalVotesCast = 0
    let votersWhoVoted = 0
    
    this.voiceCredits.forEach(credit => {
      totalCreditsIssued += credit.initialCredits
      totalCreditsSpent += credit.spentCredits
      totalCreditsRemaining += credit.remainingCredits
      
      if (credit.spentCredits > 0) {
        votersWhoVoted++
      }
    })
    
    this.ballots.forEach(ballot => {
      totalVotesCast += ballot.totalVotes
    })
    
    return {
      totalVoters: this.voiceCredits.size,
      totalCreditsIssued,
      totalCreditsSpent,
      totalCreditsRemaining,
      averageCreditsSpent: votersWhoVoted > 0 ? totalCreditsSpent / votersWhoVoted : 0,
      totalVotesCast,
      participationRate: this.voiceCredits.size > 0
        ? (votersWhoVoted / this.voiceCredits.size) * 100
        : 0
    }
  }
  
  /**
   * Simulate optimal vote allocation for a voter
   * Given preferences, find best allocation of credits
   */
  suggestAllocation(
    voterId: string,
    preferences: Map<number, number>  // candidateId -> preference score (0-100)
  ): Map<number, number> {
    const voiceCredit = this.voiceCredits.get(voterId)
    if (!voiceCredit) {
      return new Map()
    }
    
    const availableCredits = voiceCredit.remainingCredits
    const allocation = new Map<number, number>()
    
    // Sort candidates by preference
    const sortedCandidates = Array.from(preferences.entries())
      .sort((a, b) => b[1] - a[1])
    
    // Use greedy allocation based on preference strength
    let remainingCredits = availableCredits
    
    for (const [candidateId, preferenceScore] of sortedCandidates) {
      if (preferenceScore <= 0 || remainingCredits <= 0) {
        continue
      }
      
      // Allocate votes proportional to preference
      const idealVotes = Math.floor((preferenceScore / 100) * Math.sqrt(availableCredits))
      const cost = QuadraticVotingSystem.calculateCost(idealVotes)
      
      if (cost <= remainingCredits) {
        allocation.set(candidateId, idealVotes)
        remainingCredits -= cost
      } else {
        // Allocate maximum possible
        const maxVotes = QuadraticVotingSystem.calculateMaxVotes(remainingCredits)
        if (maxVotes > 0) {
          allocation.set(candidateId, maxVotes)
          remainingCredits -= QuadraticVotingSystem.calculateCost(maxVotes)
        }
      }
    }
    
    return allocation
  }
  
  /**
   * Export ballot data for blockchain
   */
  exportBallots(): Array<{
    voterId: string
    votes: Array<{ candidateId: number; votes: number; cost: number }>
    totalCreditsSpent: number
  }> {
    return Array.from(this.ballots.entries()).map(([voterId, ballot]) => ({
      voterId,
      votes: Array.from(ballot.votes.values()).map(v => ({
        candidateId: v.candidateId,
        votes: v.votes,
        cost: v.creditsCost
      })),
      totalCreditsSpent: ballot.totalCredits
    }))
  }
}

/**
 * Calculate Quadratic Voting efficiency score
 * Measures how well the system captures voter preferences vs simple voting
 */
export function calculateEfficiencyScore(
  qvResults: Map<number, number>,
  simpleVotingResults: Map<number, number>
): number {
  // Compare winner differences
  const qvWinner = Array.from(qvResults.entries())
    .sort((a, b) => b[1] - a[1])[0]
  const simpleWinner = Array.from(simpleVotingResults.entries())
    .sort((a, b) => b[1] - a[1])[0]
  
  // If winners differ, QV captured more nuance
  if (qvWinner[0] !== simpleWinner[0]) {
    return 100 // Maximum efficiency - different winner
  }
  
  // Calculate variance in vote distribution
  const qvVariance = calculateVariance(Array.from(qvResults.values()))
  const simpleVariance = calculateVariance(Array.from(simpleVotingResults.values()))
  
  // Higher variance = more nuanced expression
  return Math.min(100, (qvVariance / simpleVariance) * 100)
}

function calculateVariance(values: number[]): number {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2))
  return squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length
}

export default {
  QuadraticVotingSystem,
  calculateEfficiencyScore
}
