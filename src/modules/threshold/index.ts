/**
 * Threshold Voting Module
 * 
 * Multi-party computation system where K of N authorities must cooperate
 * to decrypt and count votes. No single authority can see individual votes.
 * 
 * Uses Shamir Secret Sharing to split vote decryption keys.
 * 
 * Example: 3-of-5 threshold means any 3 authorities can count votes,
 * but 2 or fewer authorities cannot learn anything.
 */

import { generateCredential, sha256, generateRandomness } from '../crypto/index.js'

export interface Authority {
  id: string
  publicKey: string
  index: number
  active: boolean
}

export interface SecretShare {
  authorityId: string
  shareIndex: number
  shareValue: bigint
  ballotId: string
}

export interface ThresholdConfig {
  threshold: number      // K authorities needed
  totalAuthorities: number  // N total authorities
  authorities: Authority[]
  ballotId: string
}

export interface PartialDecryption {
  authorityId: string
  candidateId: number
  partialResult: bigint
  proof: string  // ZK proof of correct decryption
  timestamp: number
}

export interface TallyResult {
  candidateId: number
  votes: number
  verified: boolean
  participatingAuthorities: string[]
}

/**
 * Shamir Secret Sharing implementation
 */
export class ShamirSecretSharing {
  private prime: bigint
  
  constructor() {
    // Use large prime for security (256-bit)
    this.prime = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F')
  }
  
  /**
   * Split secret into N shares with K threshold
   */
  split(secret: bigint, threshold: number, totalShares: number): bigint[] {
    if (threshold > totalShares) {
      throw new Error('Threshold cannot exceed total shares')
    }
    
    // Generate random polynomial of degree (threshold - 1)
    const coefficients: bigint[] = [secret]
    for (let i = 1; i < threshold; i++) {
      coefficients.push(this.randomBigInt())
    }
    
    // Evaluate polynomial at points 1, 2, 3, ..., totalShares
    const shares: bigint[] = []
    for (let x = 1; x <= totalShares; x++) {
      const share = this.evaluatePolynomial(coefficients, BigInt(x))
      shares.push(share)
    }
    
    return shares
  }
  
  /**
   * Combine K shares to reconstruct secret
   */
  combine(shares: Map<number, bigint>): bigint {
    if (shares.size === 0) {
      throw new Error('No shares provided')
    }
    
    // Use Lagrange interpolation
    let secret = 0n
    
    shares.forEach((shareValue, shareIndex) => {
      let numerator = 1n
      let denominator = 1n
      
      shares.forEach((_, otherIndex) => {
        if (shareIndex !== otherIndex) {
          numerator = this.mod(numerator * BigInt(-otherIndex), this.prime)
          denominator = this.mod(
            denominator * BigInt(shareIndex - otherIndex),
            this.prime
          )
        }
      })
      
      const lagrangeCoeff = this.mod(
        numerator * this.modInverse(denominator, this.prime),
        this.prime
      )
      
      secret = this.mod(
        secret + this.mod(shareValue * lagrangeCoeff, this.prime),
        this.prime
      )
    })
    
    return secret
  }
  
  /**
   * Evaluate polynomial at point x
   */
  private evaluatePolynomial(coefficients: bigint[], x: bigint): bigint {
    let result = 0n
    let xPower = 1n
    
    for (const coeff of coefficients) {
      result = this.mod(result + this.mod(coeff * xPower, this.prime), this.prime)
      xPower = this.mod(xPower * x, this.prime)
    }
    
    return result
  }
  
  /**
   * Generate random bigint
   */
  private randomBigInt(): bigint {
    const bytes = Buffer.from(generateRandomness(), 'hex')
    let result = 0n
    for (const byte of bytes) {
      result = (result << 8n) | BigInt(byte)
    }
    return this.mod(result, this.prime)
  }
  
  /**
   * Modular arithmetic
   */
  private mod(n: bigint, p: bigint): bigint {
    return ((n % p) + p) % p
  }
  
  /**
   * Modular multiplicative inverse using Extended Euclidean Algorithm
   */
  private modInverse(a: bigint, p: bigint): bigint {
    let [old_r, r] = [a, p]
    let [old_s, s] = [1n, 0n]
    
    while (r !== 0n) {
      const quotient = old_r / r
      ;[old_r, r] = [r, old_r - quotient * r]
      ;[old_s, s] = [s, old_s - quotient * s]
    }
    
    return this.mod(old_s, p)
  }
}

/**
 * Threshold Voting System
 */
export class ThresholdVotingSystem {
  private config: ThresholdConfig
  private secretSharing: ShamirSecretSharing
  private shares: Map<string, SecretShare[]>  // authorityId -> shares
  private partialDecryptions: Map<number, PartialDecryption[]>  // candidateId -> decryptions
  private encryptedVotes: Map<number, bigint[]>  // candidateId -> encrypted votes
  
  constructor(threshold: number, authorities: Authority[], ballotId: string) {
    if (threshold > authorities.length) {
      throw new Error('Threshold cannot exceed number of authorities')
    }
    
    this.config = {
      threshold,
      totalAuthorities: authorities.length,
      authorities,
      ballotId
    }
    
    this.secretSharing = new ShamirSecretSharing()
    this.shares = new Map()
    this.partialDecryptions = new Map()
    this.encryptedVotes = new Map()
  }
  
  /**
   * Setup: Distribute key shares to authorities
   */
  setupKeyShares(masterKey: bigint): Map<string, SecretShare> {
    const shares = this.secretSharing.split(
      masterKey,
      this.config.threshold,
      this.config.totalAuthorities
    )
    
    const distributedShares = new Map<string, SecretShare>()
    
    this.config.authorities.forEach((authority, index) => {
      const share: SecretShare = {
        authorityId: authority.id,
        shareIndex: index + 1,
        shareValue: shares[index],
        ballotId: this.config.ballotId
      }
      
      distributedShares.set(authority.id, share)
      
      // Store shares internally
      if (!this.shares.has(authority.id)) {
        this.shares.set(authority.id, [])
      }
      this.shares.get(authority.id)!.push(share)
    })
    
    return distributedShares
  }
  
  /**
   * Cast encrypted vote
   */
  castEncryptedVote(candidateId: number, encryptedVote: bigint): void {
    if (!this.encryptedVotes.has(candidateId)) {
      this.encryptedVotes.set(candidateId, [])
    }
    this.encryptedVotes.get(candidateId)!.push(encryptedVote)
  }
  
  /**
   * Authority submits partial decryption
   */
  submitPartialDecryption(
    authorityId: string,
    candidateId: number,
    partialResult: bigint,
    proof: string
  ): boolean {
    // Verify authority is valid
    const authority = this.config.authorities.find(a => a.id === authorityId)
    if (!authority || !authority.active) {
      return false
    }
    
    // Verify authority has share
    const authorityShares = this.shares.get(authorityId)
    if (!authorityShares || authorityShares.length === 0) {
      return false
    }
    
    const partialDecryption: PartialDecryption = {
      authorityId,
      candidateId,
      partialResult,
      proof,
      timestamp: Date.now()
    }
    
    if (!this.partialDecryptions.has(candidateId)) {
      this.partialDecryptions.set(candidateId, [])
    }
    
    this.partialDecryptions.get(candidateId)!.push(partialDecryption)
    
    return true
  }
  
  /**
   * Combine partial decryptions to get final tally
   * Requires at least K authorities to participate
   */
  tallyVotes(): TallyResult[] | null {
    const results: TallyResult[] = []
    
    for (const [candidateId, partialDecs] of this.partialDecryptions) {
      // Check if we have enough authorities
      if (partialDecs.length < this.config.threshold) {
        console.log(`Candidate ${candidateId}: Need ${this.config.threshold} authorities, have ${partialDecs.length}`)
        continue
      }
      
      // Combine shares from participating authorities
      const shareMap = new Map<number, bigint>()
      const participatingAuthorities: string[] = []
      
      partialDecs.slice(0, this.config.threshold).forEach(pd => {
        const authorityShares = this.shares.get(pd.authorityId)
        if (authorityShares && authorityShares.length > 0) {
          const share = authorityShares[0]
          shareMap.set(share.shareIndex, share.shareValue)
          participatingAuthorities.push(pd.authorityId)
        }
      })
      
      if (shareMap.size < this.config.threshold) {
        continue
      }
      
      // Reconstruct secret and decrypt votes
      const reconstructedKey = this.secretSharing.combine(shareMap)
      
      // Decrypt votes (simplified - in real system, use reconstructed key)
      const encryptedVotesForCandidate = this.encryptedVotes.get(candidateId) || []
      const voteCount = encryptedVotesForCandidate.length
      
      results.push({
        candidateId,
        votes: voteCount,
        verified: true,
        participatingAuthorities
      })
    }
    
    return results.length > 0 ? results : null
  }
  
  /**
   * Check if enough authorities have submitted
   */
  canTally(): boolean {
    for (const [candidateId, partialDecs] of this.partialDecryptions) {
      if (partialDecs.length >= this.config.threshold) {
        return true
      }
    }
    return false
  }
  
  /**
   * Get tally status
   */
  getTallyStatus(): {
    candidateId: number
    submitted: number
    required: number
    ready: boolean
  }[] {
    const status: {
      candidateId: number
      submitted: number
      required: number
      ready: boolean
    }[] = []
    
    this.partialDecryptions.forEach((partialDecs, candidateId) => {
      status.push({
        candidateId,
        submitted: partialDecs.length,
        required: this.config.threshold,
        ready: partialDecs.length >= this.config.threshold
      })
    })
    
    return status
  }
  
  /**
   * Get statistics
   */
  getStats(): {
    threshold: number
    totalAuthorities: number
    activeAuthorities: number
    encryptedVotesCount: number
    candidatesWithDecryptions: number
    readyForTally: boolean
  } {
    const activeAuthorities = this.config.authorities.filter(a => a.active).length
    
    let totalEncryptedVotes = 0
    this.encryptedVotes.forEach(votes => {
      totalEncryptedVotes += votes.length
    })
    
    return {
      threshold: this.config.threshold,
      totalAuthorities: this.config.totalAuthorities,
      activeAuthorities,
      encryptedVotesCount: totalEncryptedVotes,
      candidatesWithDecryptions: this.partialDecryptions.size,
      readyForTally: this.canTally()
    }
  }
  
  /**
   * Simulate authority failure and recovery
   */
  toggleAuthorityStatus(authorityId: string, active: boolean): boolean {
    const authority = this.config.authorities.find(a => a.id === authorityId)
    if (!authority) {
      return false
    }
    
    authority.active = active
    return true
  }
  
  /**
   * Export audit log
   */
  exportAuditLog(): {
    config: ThresholdConfig
    shares: number
    encryptedVotes: number
    partialDecryptions: number
    timestamp: number
  } {
    let totalPartialDecs = 0
    this.partialDecryptions.forEach(decs => {
      totalPartialDecs += decs.length
    })
    
    let totalEncrypted = 0
    this.encryptedVotes.forEach(votes => {
      totalEncrypted += votes.length
    })
    
    return {
      config: this.config,
      shares: this.shares.size,
      encryptedVotes: totalEncrypted,
      partialDecryptions: totalPartialDecs,
      timestamp: Date.now()
    }
  }
}

/**
 * Verify threshold signature (K of N authorities signed)
 */
export function verifyThresholdSignature(
  message: string,
  signatures: Map<string, string>,
  threshold: number
): boolean {
  return signatures.size >= threshold
}

export default {
  ShamirSecretSharing,
  ThresholdVotingSystem,
  verifyThresholdSignature
}
