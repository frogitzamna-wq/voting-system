import {
  SmartContract,
  method,
  prop,
  assert,
  ByteString,
  Sha256,
  FixedArray,
  fill,
  PubKey,
  Sig
} from 'scrypt-ts'

/**
 * VotingRegistry Contract
 * 
 * Stateful contract that manages election state:
 * - Tracks used nullifiers (prevents double voting)
 * - Maintains vote tallies
 * - Controls election lifecycle (active/closed)
 * - Verifies eligible voters via Merkle root
 * 
 * This is a stateful contract that gets updated with each vote.
 */
export class VotingRegistry extends SmartContract {
  // Array of used nullifiers (max 10000 votes)
  @prop(true)
  nullifiers: FixedArray<Sha256, 10000>

  // Vote counts per candidate (max 50 candidates)
  @prop(true)
  voteCounts: FixedArray<bigint, 50>

  // Merkle root of eligible voters
  @prop()
  merkleRoot: Sha256

  // Ballot identifier
  @prop()
  ballotId: bigint

  // Election active status
  @prop(true)
  isActive: boolean

  // Total votes cast
  @prop(true)
  totalVotes: bigint

  // Number of candidates
  @prop()
  candidateCount: bigint

  // Admin public key (can close election)
  @prop()
  adminPubKey: PubKey

  // Start timestamp
  @prop()
  startTime: bigint

  // End timestamp
  @prop()
  endTime: bigint

  constructor(
    merkleRoot: Sha256,
    ballotId: bigint,
    candidateCount: bigint,
    adminPubKey: PubKey,
    startTime: bigint,
    endTime: bigint
  ) {
    super(...arguments)
    this.merkleRoot = merkleRoot
    this.ballotId = ballotId
    this.candidateCount = candidateCount
    this.adminPubKey = adminPubKey
    this.startTime = startTime
    this.endTime = endTime
    this.isActive = true
    this.totalVotes = 0n
    
    // Initialize empty arrays
    this.nullifiers = fill(Sha256(toByteString('')), 10000)
    this.voteCounts = fill(0n, 50)
  }

  /**
   * Register a new vote
   * 
   * @param voteCommitment - Commitment to vote choice
   * @param nullifier - Unique nullifier for this vote
   * @param zkProof - Zero-knowledge proof of eligibility
   * @param candidateIndex - Index of chosen candidate
   */
  @method()
  public registerVote(
    voteCommitment: Sha256,
    nullifier: Sha256,
    zkProof: ByteString,
    candidateIndex: bigint
  ): boolean {
    // 1. Check election is active
    assert(this.isActive, 'Ballot closed')

    // 2. Check within voting period
    const currentTime = this.ctx.locktime
    assert(
      currentTime >= this.startTime && currentTime <= this.endTime,
      'Outside voting period'
    )

    // 3. Check nullifier hasn't been used (no double voting)
    assert(!this.hasNullifier(nullifier), 'Double vote detected')

    // 4. Verify candidate index is valid
    assert(
      candidateIndex >= 0n && candidateIndex < this.candidateCount,
      'Invalid candidate index'
    )

    // 5. Verify ZK proof (proves voter eligibility without revealing identity)
    const proofValid = this.verifyVoteProof(zkProof, voteCommitment, nullifier)
    assert(proofValid, 'Invalid ZK proof')

    // 6. Record nullifier
    this.addNullifier(nullifier)

    // 7. Increment vote count for chosen candidate
    this.voteCounts[Number(candidateIndex)]++

    // 8. Increment total votes
    this.totalVotes++

    // 9. Update state outputs
    const outputs = this.buildStateOutput(this.ctx.utxo.value)
    assert(this.ctx.hashOutputs == hash256(outputs), 'hashOutputs mismatch')

    return true
  }

  /**
   * Check if nullifier already exists
   * 
   * @param nullifier - Nullifier to check
   * @returns true if nullifier exists
   */
  @method()
  hasNullifier(nullifier: Sha256): boolean {
    let exists = false
    
    for (let i = 0; i < 10000; i++) {
      if (this.nullifiers[i] == nullifier) {
        exists = true
        break
      }
    }
    
    return exists
  }

  /**
   * Add nullifier to used list
   * 
   * @param nullifier - Nullifier to add
   */
  @method()
  addNullifier(nullifier: Sha256): void {
    // Find first empty slot and add nullifier
    for (let i = 0; i < 10000; i++) {
      const isEmpty = this.nullifiers[i] == Sha256(toByteString(''))
      
      if (isEmpty) {
        this.nullifiers[i] = nullifier
        break
      }
    }
  }

  /**
   * Verify zero-knowledge proof for vote
   * 
   * @param proof - ZK proof bytes
   * @param commitment - Vote commitment
   * @param nullifier - Nullifier hash
   * @returns true if proof is valid
   */
  @method()
  verifyVoteProof(
    proof: ByteString,
    commitment: Sha256,
    nullifier: Sha256
  ): boolean {
    // TODO: Integrate with actual ZK verifier
    // This would use scrypt-plonk-verifier or scrypt-cairo-verifier
    
    // Verify proof structure
    assert(len(proof) > 0n, 'Empty proof')
    
    // In production:
    // const publicInputs = this.serializeZKInputs(commitment, nullifier)
    // return PlonkVerifier.verify(proof, publicInputs, verificationKey)
    
    return true
  }

  /**
   * Close the ballot (admin only)
   * 
   * @param adminSig - Admin signature
   */
  @method()
  public closeBallot(adminSig: Sig): boolean {
    // Verify admin signature
    assert(
      this.checkSig(adminSig, this.adminPubKey),
      'Invalid admin signature'
    )

    // Check election was active
    assert(this.isActive, 'Already closed')

    // Close the ballot
    this.isActive = false

    // Update state outputs
    const outputs = this.buildStateOutput(this.ctx.utxo.value)
    assert(this.ctx.hashOutputs == hash256(outputs), 'hashOutputs mismatch')

    return true
  }

  /**
   * Get vote tally for specific candidate
   * 
   * @param candidateIndex - Candidate index
   * @returns vote count
   */
  @method()
  public getCandidateVotes(candidateIndex: bigint): bigint {
    assert(
      candidateIndex >= 0n && candidateIndex < this.candidateCount,
      'Invalid candidate index'
    )
    
    return this.voteCounts[Number(candidateIndex)]
  }

  /**
   * Get total votes cast
   * 
   * @returns total vote count
   */
  @method()
  public getTotalVotes(): bigint {
    return this.totalVotes
  }

  /**
   * Get complete tally (only after ballot closed)
   * 
   * @returns array of vote counts
   */
  @method()
  public getTally(): FixedArray<bigint, 50> {
    assert(!this.isActive, 'Ballot still active')
    return this.voteCounts
  }

  /**
   * Check if ballot is active
   * 
   * @returns true if active
   */
  @method()
  public getStatus(): boolean {
    return this.isActive
  }

  /**
   * Get ballot ID
   * 
   * @returns ballot identifier
   */
  @method()
  public getBallotId(): bigint {
    return this.ballotId
  }

  /**
   * Verify merkle proof of voter eligibility
   * 
   * @param leaf - Voter commitment
   * @param merklePath - Merkle proof path
   * @param merkleIndices - Path indices
   * @returns true if voter is eligible
   */
  @method()
  public verifyVoterEligibility(
    leaf: Sha256,
    merklePath: FixedArray<Sha256, 32>,
    merkleIndices: bigint
  ): boolean {
    let computedHash = leaf

    for (let i = 0; i < 32; i++) {
      const pathElement = merklePath[i]
      const isLeftNode = (merkleIndices >> BigInt(i)) & 1n

      if (isLeftNode == 1n) {
        computedHash = hash256(computedHash + pathElement)
      } else {
        computedHash = hash256(pathElement + computedHash)
      }
    }

    return computedHash == this.merkleRoot
  }
}
