/**
 * Multi-Round Runoff Voting System
 * 
 * Automatic runoff elections when no candidate achieves majority (>50%).
 * Features:
 * - Automatic triggering of runoff rounds
 * - Configurable threshold (default 50% + 1)
 * - Multiple elimination strategies (bottom N, below threshold)
 * - Instant Runoff Voting (IRV) support
 * - Ranked Choice Voting (RCV) compatibility
 * 
 * Use cases:
 * - Presidential elections
 * - Board director elections
 * - Community governance
 */

import { generateCredential, sha256 } from '../crypto/index.js'

export type EliminationStrategy = 'bottom_n' | 'below_threshold' | 'instant_runoff'

export interface Candidate {
  id: string
  name: string
  eliminated: boolean
  roundEliminated?: number
}

export interface RoundResult {
  roundNumber: number
  candidateVotes: Map<string, number>
  totalVotes: number
  winner?: string
  winnerId?: string
  winnerPercentage?: number
  eliminated: string[]  // Candidate IDs
  threshold: number
  timestamp: number
}

export interface RankedVote {
  voterId: string
  preferences: string[]  // Ordered candidate IDs (1st, 2nd, 3rd...)
  voteId: string
  timestamp: number
}

export interface RunoffElection {
  electionId: string
  ballotId: string
  candidates: Map<string, Candidate>
  rounds: RoundResult[]
  votes: RankedVote[]
  config: RunoffConfig
  status: 'pending' | 'active' | 'runoff' | 'completed'
  currentRound: number
  finalWinner?: string
  completedAt?: number
}

export interface RunoffConfig {
  majorityThreshold: number  // e.g., 0.50 for 50%
  maxRounds: number
  eliminationStrategy: EliminationStrategy
  eliminateCount: number  // How many to eliminate per round
  minCandidates: number   // Minimum candidates for runoff (default 2)
  automaticTrigger: boolean
  allowTieBreaker: boolean
}

/**
 * Multi-Round Runoff Voting System
 */
export class RunoffVotingSystem {
  private elections: Map<string, RunoffElection>
  
  constructor() {
    this.elections = new Map()
  }
  
  /**
   * Create runoff election
   */
  createElection(
    ballotId: string,
    candidateNames: string[],
    config: Partial<RunoffConfig> = {}
  ): RunoffElection {
    const defaultConfig: RunoffConfig = {
      majorityThreshold: 0.50,
      maxRounds: 10,
      eliminationStrategy: 'bottom_n',
      eliminateCount: 1,
      minCandidates: 2,
      automaticTrigger: true,
      allowTieBreaker: true
    }
    
    const candidates = new Map<string, Candidate>()
    for (const name of candidateNames) {
      const id = generateCredential()
      candidates.set(id, {
        id,
        name,
        eliminated: false
      })
    }
    
    const election: RunoffElection = {
      electionId: generateCredential(),
      ballotId,
      candidates,
      rounds: [],
      votes: [],
      config: { ...defaultConfig, ...config },
      status: 'pending',
      currentRound: 0
    }
    
    this.elections.set(election.electionId, election)
    return election
  }
  
  /**
   * Cast ranked vote
   */
  castVote(
    electionId: string,
    voterId: string,
    preferences: string[]
  ): RankedVote {
    const election = this.elections.get(electionId)
    if (!election) {
      throw new Error('Election not found')
    }
    
    if (election.status === 'completed') {
      throw new Error('Election already completed')
    }
    
    // Validate preferences
    for (const candidateId of preferences) {
      if (!election.candidates.has(candidateId)) {
        throw new Error(`Invalid candidate ID: ${candidateId}`)
      }
    }
    
    // Check for duplicate votes
    const existingVote = election.votes.find(v => v.voterId === voterId)
    if (existingVote) {
      throw new Error('Voter has already voted')
    }
    
    const vote: RankedVote = {
      voterId,
      preferences,
      voteId: generateCredential(),
      timestamp: Date.now()
    }
    
    election.votes.push(vote)
    return vote
  }
  
  /**
   * Start election (count first round)
   */
  startElection(electionId: string): RoundResult {
    const election = this.elections.get(electionId)
    if (!election) {
      throw new Error('Election not found')
    }
    
    if (election.votes.length === 0) {
      throw new Error('No votes cast')
    }
    
    election.status = 'active'
    election.currentRound = 1
    
    return this.countRound(electionId)
  }
  
  /**
   * Count current round
   */
  private countRound(electionId: string): RoundResult {
    const election = this.elections.get(electionId)!
    
    const candidateVotes = new Map<string, number>()
    const activeCandidates = Array.from(election.candidates.values())
      .filter(c => !c.eliminated)
    
    // Initialize vote counts
    for (const candidate of activeCandidates) {
      candidateVotes.set(candidate.id, 0)
    }
    
    // Count votes based on highest-ranked non-eliminated candidate
    for (const vote of election.votes) {
      const topChoice = this.getTopChoice(vote.preferences, election.candidates)
      if (topChoice) {
        candidateVotes.set(topChoice, (candidateVotes.get(topChoice) || 0) + 1)
      }
    }
    
    const totalVotes = election.votes.length
    const result: RoundResult = {
      roundNumber: election.currentRound,
      candidateVotes,
      totalVotes,
      eliminated: [],
      threshold: election.config.majorityThreshold,
      timestamp: Date.now()
    }
    
    // Check for winner
    const winner = this.checkMajority(candidateVotes, totalVotes, election.config.majorityThreshold)
    if (winner) {
      result.winner = election.candidates.get(winner.candidateId)!.name
      result.winnerId = winner.candidateId
      result.winnerPercentage = winner.percentage
      
      election.status = 'completed'
      election.finalWinner = winner.candidateId
      election.completedAt = Date.now()
    }
    
    election.rounds.push(result)
    return result
  }
  
  /**
   * Get top choice from ranked preferences
   */
  private getTopChoice(
    preferences: string[],
    candidates: Map<string, Candidate>
  ): string | null {
    for (const candidateId of preferences) {
      const candidate = candidates.get(candidateId)
      if (candidate && !candidate.eliminated) {
        return candidateId
      }
    }
    return null
  }
  
  /**
   * Check if any candidate has majority
   */
  private checkMajority(
    votes: Map<string, number>,
    totalVotes: number,
    threshold: number
  ): { candidateId: string; percentage: number } | null {
    for (const [candidateId, voteCount] of votes.entries()) {
      const percentage = voteCount / totalVotes
      if (percentage > threshold) {
        return { candidateId, percentage }
      }
    }
    return null
  }
  
  /**
   * Trigger runoff round
   */
  runoffRound(electionId: string): RoundResult | null {
    const election = this.elections.get(electionId)
    if (!election) {
      throw new Error('Election not found')
    }
    
    if (election.status === 'completed') {
      throw new Error('Election already completed')
    }
    
    if (election.currentRound >= election.config.maxRounds) {
      return this.resolveWithTieBreaker(electionId)
    }
    
    const lastRound = election.rounds[election.rounds.length - 1]
    
    // Eliminate candidates based on strategy
    const eliminated = this.eliminateCandidates(election, lastRound)
    
    if (eliminated.length === 0) {
      return this.resolveWithTieBreaker(electionId)
    }
    
    // Mark candidates as eliminated
    for (const candidateId of eliminated) {
      const candidate = election.candidates.get(candidateId)!
      candidate.eliminated = true
      candidate.roundEliminated = election.currentRound
    }
    
    // Count remaining candidates
    const remaining = Array.from(election.candidates.values())
      .filter(c => !c.eliminated).length
    
    if (remaining < election.config.minCandidates) {
      return this.resolveFinalWinner(electionId)
    }
    
    // Next round
    election.currentRound++
    election.status = 'runoff'
    
    return this.countRound(electionId)
  }
  
  /**
   * Eliminate candidates based on strategy
   */
  private eliminateCandidates(
    election: RunoffElection,
    lastRound: RoundResult
  ): string[] {
    const { eliminationStrategy, eliminateCount } = election.config
    const eliminated: string[] = []
    
    const sortedCandidates = Array.from(lastRound.candidateVotes.entries())
      .filter(([id]) => !election.candidates.get(id)!.eliminated)
      .sort((a, b) => a[1] - b[1])  // Ascending by votes
    
    if (sortedCandidates.length <= election.config.minCandidates) {
      return []
    }
    
    switch (eliminationStrategy) {
      case 'bottom_n':
        // Eliminate N lowest-performing candidates
        const toEliminate = Math.min(
          eliminateCount,
          sortedCandidates.length - election.config.minCandidates
        )
        for (let i = 0; i < toEliminate; i++) {
          eliminated.push(sortedCandidates[i][0])
        }
        break
        
      case 'below_threshold':
        // Eliminate candidates below threshold percentage
        const minVotes = lastRound.totalVotes * election.config.majorityThreshold * 0.5
        for (const [candidateId, votes] of sortedCandidates) {
          if (votes < minVotes && sortedCandidates.length - eliminated.length > election.config.minCandidates) {
            eliminated.push(candidateId)
          }
        }
        break
        
      case 'instant_runoff':
        // Instant Runoff: eliminate only the single lowest
        if (sortedCandidates.length > election.config.minCandidates) {
          eliminated.push(sortedCandidates[0][0])
        }
        break
    }
    
    return eliminated
  }
  
  /**
   * Resolve final winner when only minCandidates remain
   */
  private resolveFinalWinner(electionId: string): RoundResult {
    const election = this.elections.get(electionId)!
    const lastRound = election.rounds[election.rounds.length - 1]
    
    // Find candidate with most votes
    let maxVotes = 0
    let winnerId = ''
    
    for (const [candidateId, votes] of lastRound.candidateVotes.entries()) {
      const candidate = election.candidates.get(candidateId)!
      if (!candidate.eliminated && votes > maxVotes) {
        maxVotes = votes
        winnerId = candidateId
      }
    }
    
    election.status = 'completed'
    election.finalWinner = winnerId
    election.completedAt = Date.now()
    
    const finalResult: RoundResult = {
      ...lastRound,
      winner: election.candidates.get(winnerId)!.name,
      winnerId,
      winnerPercentage: maxVotes / lastRound.totalVotes,
      timestamp: Date.now()
    }
    
    election.rounds[election.rounds.length - 1] = finalResult
    return finalResult
  }
  
  /**
   * Tie-breaker resolution
   */
  private resolveWithTieBreaker(electionId: string): RoundResult | null {
    const election = this.elections.get(electionId)!
    
    if (!election.config.allowTieBreaker) {
      throw new Error('Maximum rounds reached without winner')
    }
    
    const lastRound = election.rounds[election.rounds.length - 1]
    const sortedCandidates = Array.from(lastRound.candidateVotes.entries())
      .filter(([id]) => !election.candidates.get(id)!.eliminated)
      .sort((a, b) => b[1] - a[1])
    
    // Coin flip tie-breaker (deterministic using hash)
    const tieData = sortedCandidates.map(c => c[0]).join(':')
    const tieHash = sha256(Buffer.from(tieData))
    const winner = sortedCandidates[tieHash[0] % sortedCandidates.length]
    
    election.status = 'completed'
    election.finalWinner = winner[0]
    election.completedAt = Date.now()
    
    const finalResult: RoundResult = {
      ...lastRound,
      winner: election.candidates.get(winner[0])!.name,
      winnerId: winner[0],
      winnerPercentage: winner[1] / lastRound.totalVotes,
      timestamp: Date.now()
    }
    
    election.rounds[election.rounds.length - 1] = finalResult
    return finalResult
  }
  
  /**
   * Run complete election with automatic runoffs
   */
  runCompleteElection(electionId: string): RoundResult[] {
    const election = this.elections.get(electionId)
    if (!election) {
      throw new Error('Election not found')
    }
    
    // Start first round
    this.startElection(electionId)
    
    // Continue runoffs until winner
    while (election.status !== 'completed') {
      const result = this.runoffRound(electionId)
      if (!result) {
        break
      }
    }
    
    return election.rounds
  }
  
  /**
   * Get election results
   */
  getResults(electionId: string): {
    election: RunoffElection
    rounds: RoundResult[]
    winner?: {
      id: string
      name: string
      percentage: number
      roundWon: number
    }
  } {
    const election = this.elections.get(electionId)
    if (!election) {
      throw new Error('Election not found')
    }
    
    let winner = undefined
    if (election.finalWinner) {
      const finalRound = election.rounds[election.rounds.length - 1]
      winner = {
        id: election.finalWinner,
        name: election.candidates.get(election.finalWinner)!.name,
        percentage: finalRound.winnerPercentage || 0,
        roundWon: finalRound.roundNumber
      }
    }
    
    return {
      election,
      rounds: election.rounds,
      winner
    }
  }
  
  /**
   * Get round-by-round breakdown
   */
  getRoundBreakdown(electionId: string): {
    roundNumber: number
    results: { candidate: string; votes: number; percentage: number; eliminated: boolean }[]
  }[] {
    const election = this.elections.get(electionId)
    if (!election) {
      throw new Error('Election not found')
    }
    
    return election.rounds.map(round => ({
      roundNumber: round.roundNumber,
      results: Array.from(round.candidateVotes.entries()).map(([id, votes]) => {
        const candidate = election.candidates.get(id)!
        return {
          candidate: candidate.name,
          votes,
          percentage: (votes / round.totalVotes) * 100,
          eliminated: round.eliminated.includes(id)
        }
      }).sort((a, b) => b.votes - a.votes)
    }))
  }
}

/**
 * Instant Runoff Voting (IRV) Helper
 * 
 * Single-round computation of IRV using all ranked preferences
 */
export class InstantRunoffVoting {
  /**
   * Compute IRV winner in single pass
   */
  static computeWinner(
    votes: RankedVote[],
    candidates: string[],
    threshold: number = 0.5
  ): {
    winner: string
    rounds: { candidate: string; votes: number; eliminated: boolean }[][]
  } {
    const activeCandidates = new Set(candidates)
    const rounds: { candidate: string; votes: number; eliminated: boolean }[][] = []
    
    while (activeCandidates.size > 1) {
      const voteCounts = new Map<string, number>()
      
      // Initialize counts
      for (const candidate of activeCandidates) {
        voteCounts.set(candidate, 0)
      }
      
      // Count first preferences among active candidates
      for (const vote of votes) {
        for (const pref of vote.preferences) {
          if (activeCandidates.has(pref)) {
            voteCounts.set(pref, voteCounts.get(pref)! + 1)
            break
          }
        }
      }
      
      // Check for majority
      const totalVotes = votes.length
      for (const [candidate, count] of voteCounts.entries()) {
        if (count / totalVotes > threshold) {
          rounds.push(
            Array.from(voteCounts.entries()).map(([c, v]) => ({
              candidate: c,
              votes: v,
              eliminated: c !== candidate
            }))
          )
          return { winner: candidate, rounds }
        }
      }
      
      // Eliminate candidate with fewest votes
      let minVotes = Infinity
      let toEliminate = ''
      for (const [candidate, count] of voteCounts.entries()) {
        if (count < minVotes) {
          minVotes = count
          toEliminate = candidate
        }
      }
      
      activeCandidates.delete(toEliminate)
      
      rounds.push(
        Array.from(voteCounts.entries()).map(([c, v]) => ({
          candidate: c,
          votes: v,
          eliminated: c === toEliminate
        }))
      )
    }
    
    const winner = Array.from(activeCandidates)[0]
    return { winner, rounds }
  }
}

export default {
  RunoffVotingSystem,
  InstantRunoffVoting
}
