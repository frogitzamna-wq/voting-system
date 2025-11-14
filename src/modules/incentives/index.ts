/**
 * Verifier Incentive System
 * 
 * Economic model to incentivize public auditors to verify election integrity.
 * Uses BSV micropayments to reward verifiers for:
 * - Verifying Merkle proofs
 * - Checking ZK proofs
 * - Detecting fraud/errors
 * - Maintaining uptime
 * 
 * Inspired by blockchain mining rewards but for election verification.
 */

import { generateCredential, sha256 } from '../crypto/index.js'

export interface Verifier {
  id: string
  address: string  // BSV payment address
  publicKey: string
  reputation: number  // 0-100 score
  totalVerifications: number
  successfulVerifications: number
  fraudsDetected: number
  earnings: number  // In satoshis
  joinedAt: number
  lastActive: number
  status: 'active' | 'inactive' | 'suspended'
}

export interface VerificationTask {
  taskId: string
  type: 'merkle_proof' | 'zk_proof' | 'nullifier_check' | 'tally_audit'
  ballotId: string
  data: any
  reward: number  // Satoshis
  difficulty: number  // 1-10
  createdAt: number
  deadline: number
  assignedTo?: string  // Verifier ID
  completedAt?: number
  result?: VerificationResult
}

export interface VerificationResult {
  taskId: string
  verifierId: string
  success: boolean
  proofOfWork: string  // Hash showing computation
  timestamp: number
  findings?: string[]  // Issues found
  signature: string
}

export interface PaymentRecord {
  paymentId: string
  verifierId: string
  amount: number  // Satoshis
  taskId: string
  txId: string  // BSV transaction ID
  timestamp: number
  status: 'pending' | 'confirmed' | 'failed'
}

export interface FraudBounty {
  bountyId: string
  ballotId: string
  amount: number  // Satoshis
  description: string
  claimedBy?: string
  claimedAt?: number
  verified: boolean
}

/**
 * Verifier Incentive System
 */
export class VerifierIncentiveSystem {
  private verifiers: Map<string, Verifier>
  private tasks: Map<string, VerificationTask>
  private payments: Map<string, PaymentRecord>
  private bounties: Map<string, FraudBounty>
  private treasuryBalance: number  // Pool for rewards
  
  // Reward configuration
  private baseReward: number = 100  // Base satoshis per verification
  private fraudBountyMultiplier: number = 1000  // 1000x for fraud detection
  private reputationBonus: number = 0.1  // 10% bonus per reputation point
  
  constructor(initialTreasury: number = 100000) {
    this.verifiers = new Map()
    this.tasks = new Map()
    this.payments = new Map()
    this.bounties = new Map()
    this.treasuryBalance = initialTreasury
  }
  
  /**
   * Register a verifier
   */
  registerVerifier(address: string, publicKey: string): Verifier {
    const verifier: Verifier = {
      id: generateCredential(),
      address,
      publicKey,
      reputation: 50,  // Start at median
      totalVerifications: 0,
      successfulVerifications: 0,
      fraudsDetected: 0,
      earnings: 0,
      joinedAt: Date.now(),
      lastActive: Date.now(),
      status: 'active'
    }
    
    this.verifiers.set(verifier.id, verifier)
    return verifier
  }
  
  /**
   * Create verification task
   */
  createTask(
    type: VerificationTask['type'],
    ballotId: string,
    data: any,
    difficulty: number
  ): VerificationTask {
    const reward = this.calculateReward(difficulty)
    
    const task: VerificationTask = {
      taskId: generateCredential(),
      type,
      ballotId,
      data,
      reward,
      difficulty,
      createdAt: Date.now(),
      deadline: Date.now() + (60 * 60 * 1000) // 1 hour
    }
    
    this.tasks.set(task.taskId, task)
    return task
  }
  
  /**
   * Assign task to verifier
   */
  assignTask(taskId: string, verifierId: string): boolean {
    const task = this.tasks.get(taskId)
    const verifier = this.verifiers.get(verifierId)
    
    if (!task || !verifier || task.assignedTo) {
      return false
    }
    
    if (verifier.status !== 'active') {
      return false
    }
    
    task.assignedTo = verifierId
    verifier.lastActive = Date.now()
    
    return true
  }
  
  /**
   * Submit verification result
   */
  submitVerification(
    taskId: string,
    verifierId: string,
    success: boolean,
    findings?: string[],
    signature?: string
  ): VerificationResult {
    const task = this.tasks.get(taskId)
    const verifier = this.verifiers.get(verifierId)
    
    if (!task || !verifier || task.assignedTo !== verifierId) {
      throw new Error('Invalid task or verifier')
    }
    
    // Generate proof of work
    const proofOfWork = this.generateProofOfWork(taskId, verifierId)
    
    const result: VerificationResult = {
      taskId,
      verifierId,
      success,
      proofOfWork,
      timestamp: Date.now(),
      findings,
      signature: signature || ''
    }
    
    task.result = result
    task.completedAt = Date.now()
    
    // Update verifier stats
    verifier.totalVerifications++
    if (success) {
      verifier.successfulVerifications++
    }
    
    // Detect fraud
    if (findings && findings.length > 0) {
      verifier.fraudsDetected++
      this.handleFraudDetection(verifierId, task, findings)
    }
    
    // Process payment
    this.processPayment(verifierId, task)
    
    // Update reputation
    this.updateReputation(verifierId)
    
    return result
  }
  
  /**
   * Calculate reward based on difficulty and reputation
   */
  private calculateReward(difficulty: number, verifierReputation?: number): number {
    let reward = this.baseReward * difficulty
    
    if (verifierReputation) {
      const bonus = reward * (verifierReputation / 100) * this.reputationBonus
      reward += bonus
    }
    
    return Math.floor(reward)
  }
  
  /**
   * Process payment to verifier
   */
  private processPayment(verifierId: string, task: VerificationTask): PaymentRecord {
    const verifier = this.verifiers.get(verifierId)!
    const reward = this.calculateReward(task.difficulty, verifier.reputation)
    
    if (this.treasuryBalance < reward) {
      throw new Error('Insufficient treasury balance')
    }
    
    const payment: PaymentRecord = {
      paymentId: generateCredential(),
      verifierId,
      amount: reward,
      taskId: task.taskId,
      txId: this.createBSVTransaction(verifier.address, reward),
      timestamp: Date.now(),
      status: 'pending'
    }
    
    this.payments.set(payment.paymentId, payment)
    this.treasuryBalance -= reward
    verifier.earnings += reward
    
    return payment
  }
  
  /**
   * Handle fraud detection
   */
  private handleFraudDetection(
    verifierId: string,
    task: VerificationTask,
    findings: string[]
  ): void {
    const bountyAmount = task.reward * this.fraudBountyMultiplier
    
    const bounty: FraudBounty = {
      bountyId: generateCredential(),
      ballotId: task.ballotId,
      amount: bountyAmount,
      description: findings.join('; '),
      claimedBy: verifierId,
      claimedAt: Date.now(),
      verified: false  // Needs validation by other verifiers
    }
    
    this.bounties.set(bounty.bountyId, bounty)
  }
  
  /**
   * Verify fraud claim by multiple verifiers
   */
  verifyFraudClaim(bountyId: string, verifierIds: string[]): boolean {
    const bounty = this.bounties.get(bountyId)
    if (!bounty) {
      return false
    }
    
    // Require 3+ verifiers to confirm
    if (verifierIds.length < 3) {
      return false
    }
    
    bounty.verified = true
    
    // Pay bounty
    const verifier = this.verifiers.get(bounty.claimedBy!)!
    this.treasuryBalance -= bounty.amount
    verifier.earnings += bounty.amount
    
    // Boost reputation
    verifier.reputation = Math.min(100, verifier.reputation + 10)
    
    return true
  }
  
  /**
   * Update verifier reputation based on performance
   */
  private updateReputation(verifierId: string): void {
    const verifier = this.verifiers.get(verifierId)!
    
    if (verifier.totalVerifications < 10) {
      return  // Need history
    }
    
    const successRate = verifier.successfulVerifications / verifier.totalVerifications
    const fraudBonus = verifier.fraudsDetected * 5
    
    let newReputation = Math.floor(successRate * 80) + fraudBonus
    newReputation = Math.max(0, Math.min(100, newReputation))
    
    verifier.reputation = newReputation
    
    // Suspend low performers
    if (newReputation < 20 && verifier.totalVerifications > 50) {
      verifier.status = 'suspended'
    }
  }
  
  /**
   * Generate proof of work for verification
   */
  private generateProofOfWork(taskId: string, verifierId: string): string {
    const data = `${taskId}:${verifierId}:${Date.now()}`
    return sha256(Buffer.from(data)).toString('hex')
  }
  
  /**
   * Create BSV transaction (simplified)
   */
  private createBSVTransaction(address: string, amount: number): string {
    // In real implementation, use BSV SDK to create actual transaction
    return `bsv_tx_${generateCredential().substring(0, 16)}`
  }
  
  /**
   * Get available tasks for verifier
   */
  getAvailableTasks(verifierId: string): VerificationTask[] {
    const verifier = this.verifiers.get(verifierId)
    if (!verifier || verifier.status !== 'active') {
      return []
    }
    
    return Array.from(this.tasks.values()).filter(task => 
      !task.assignedTo && 
      task.deadline > Date.now()
    )
  }
  
  /**
   * Get verifier leaderboard
   */
  getLeaderboard(limit: number = 10): Verifier[] {
    return Array.from(this.verifiers.values())
      .sort((a, b) => {
        // Sort by reputation, then earnings
        if (b.reputation !== a.reputation) {
          return b.reputation - a.reputation
        }
        return b.earnings - a.earnings
      })
      .slice(0, limit)
  }
  
  /**
   * Get verifier statistics
   */
  getVerifierStats(verifierId: string): {
    verifier: Verifier
    rank: number
    averageReward: number
    successRate: number
    fraudDetectionRate: number
  } | null {
    const verifier = this.verifiers.get(verifierId)
    if (!verifier) {
      return null
    }
    
    const leaderboard = this.getLeaderboard(this.verifiers.size)
    const rank = leaderboard.findIndex(v => v.id === verifierId) + 1
    
    const averageReward = verifier.totalVerifications > 0
      ? verifier.earnings / verifier.totalVerifications
      : 0
    
    const successRate = verifier.totalVerifications > 0
      ? (verifier.successfulVerifications / verifier.totalVerifications) * 100
      : 0
    
    const fraudDetectionRate = verifier.totalVerifications > 0
      ? (verifier.fraudsDetected / verifier.totalVerifications) * 100
      : 0
    
    return {
      verifier,
      rank,
      averageReward,
      successRate,
      fraudDetectionRate
    }
  }
  
  /**
   * Get system statistics
   */
  getSystemStats(): {
    totalVerifiers: number
    activeVerifiers: number
    totalTasks: number
    completedTasks: number
    pendingTasks: number
    totalPaid: number
    treasuryBalance: number
    averageReward: number
    totalFraudsDetected: number
  } {
    const activeVerifiers = Array.from(this.verifiers.values())
      .filter(v => v.status === 'active').length
    
    const completedTasks = Array.from(this.tasks.values())
      .filter(t => t.completedAt).length
    
    const pendingTasks = Array.from(this.tasks.values())
      .filter(t => !t.completedAt && t.deadline > Date.now()).length
    
    const totalPaid = Array.from(this.payments.values())
      .reduce((sum, p) => sum + p.amount, 0)
    
    const averageReward = completedTasks > 0 ? totalPaid / completedTasks : 0
    
    const totalFraudsDetected = Array.from(this.verifiers.values())
      .reduce((sum, v) => sum + v.fraudsDetected, 0)
    
    return {
      totalVerifiers: this.verifiers.size,
      activeVerifiers,
      totalTasks: this.tasks.size,
      completedTasks,
      pendingTasks,
      totalPaid,
      treasuryBalance: this.treasuryBalance,
      averageReward,
      totalFraudsDetected
    }
  }
  
  /**
   * Add funds to treasury
   */
  fundTreasury(amount: number): void {
    this.treasuryBalance += amount
  }
  
  /**
   * Batch create verification tasks for election
   */
  createElectionVerificationTasks(
    ballotId: string,
    voteCount: number
  ): VerificationTask[] {
    const tasks: VerificationTask[] = []
    
    // Merkle proof verifications (sample 10% of votes)
    const merkleChecks = Math.ceil(voteCount * 0.1)
    for (let i = 0; i < merkleChecks; i++) {
      tasks.push(this.createTask('merkle_proof', ballotId, { index: i }, 3))
    }
    
    // ZK proof verifications (sample 5% of votes)
    const zkChecks = Math.ceil(voteCount * 0.05)
    for (let i = 0; i < zkChecks; i++) {
      tasks.push(this.createTask('zk_proof', ballotId, { index: i }, 7))
    }
    
    // Nullifier checks (check for duplicates)
    tasks.push(this.createTask('nullifier_check', ballotId, { voteCount }, 5))
    
    // Final tally audit
    tasks.push(this.createTask('tally_audit', ballotId, { voteCount }, 10))
    
    return tasks
  }
}

/**
 * Calculate optimal reward distribution
 */
export function calculateOptimalRewards(
  totalBudget: number,
  taskDifficulties: number[]
): number[] {
  const totalDifficulty = taskDifficulties.reduce((sum, d) => sum + d, 0)
  
  return taskDifficulties.map(difficulty => 
    Math.floor((difficulty / totalDifficulty) * totalBudget)
  )
}

/**
 * Economic model for sustainable verification
 */
export class VerificationEconomy {
  /**
   * Calculate break-even point for verifier
   */
  static calculateBreakEven(
    operatingCost: number,  // Per hour in satoshis
    verificationsPerHour: number,
    averageReward: number
  ): boolean {
    const hourlyRevenue = verificationsPerHour * averageReward
    return hourlyRevenue >= operatingCost
  }
  
  /**
   * Calculate ROI for verification operation
   */
  static calculateROI(
    investment: number,      // Setup cost
    monthlyRevenue: number,  // Expected revenue
    months: number
  ): number {
    const totalRevenue = monthlyRevenue * months
    return ((totalRevenue - investment) / investment) * 100
  }
}

export default {
  VerifierIncentiveSystem,
  VerificationEconomy,
  calculateOptimalRewards
}
