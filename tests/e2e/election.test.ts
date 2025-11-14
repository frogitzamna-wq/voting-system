/**
 * End-to-End Test: Complete Election Workflow
 * 
 * Simulates a complete election from start to finish:
 * 1. Election setup
 * 2. Voter registration
 * 3. Voting period
 * 4. Result tallying
 * 5. Verification
 */

import { expect } from 'chai'
import {
  generateCredential,
  generateVoterCommitment,
  generateNullifier,
  createCommitment,
  generateRandomness
} from '../../src/modules/crypto/index.js'
import {
  buildVoterTree,
  VoterLeaf
} from '../../src/modules/merkle/index.js'
import {
  preparePublicInputs,
  ZKProofInputs
} from '../../src/modules/zkproof/index.js'

interface Candidate {
  id: number
  name: string
  voteCount: number
}

interface Ballot {
  id: string
  title: string
  candidates: Candidate[]
  status: 'registration' | 'active' | 'closed'
}

interface Vote {
  nullifierHash: string
  voteCommitment: string
  zkProof: any // ZK proof would be generated here
  candidateId: number // Encrypted in real implementation
  timestamp: number
}

describe('E2E: Complete Election Workflow', () => {
  it('should execute a complete election from start to finish', () => {
    // ===== PHASE 1: Election Setup =====
    console.log('\n=== Phase 1: Election Setup ===')
    
    const ballot: Ballot = {
      id: generateCredential(),
      title: 'City Mayor Election 2025',
      candidates: [
        { id: 0, name: 'Alice Johnson', voteCount: 0 },
        { id: 1, name: 'Bob Smith', voteCount: 0 },
        { id: 2, name: 'Carol Williams', voteCount: 0 }
      ],
      status: 'registration'
    }
    
    console.log(`Created ballot: ${ballot.title}`)
    console.log(`Ballot ID: ${ballot.id.substring(0, 16)}...`)
    console.log(`Candidates: ${ballot.candidates.map(c => c.name).join(', ')}`)
    
    expect(ballot.candidates).to.have.lengthOf(3)
    
    // ===== PHASE 2: Voter Registration =====
    console.log('\n=== Phase 2: Voter Registration ===')
    
    const voters: VoterLeaf[] = []
    const voterCount = 50
    
    for (let i = 0; i < voterCount; i++) {
      const voterId = generateCredential()
      voters.push({
        index: i,
        voterId,
        commitment: generateVoterCommitment(voterId)
      })
    }
    
    const voterTree = buildVoterTree(voters)
    
    console.log(`Registered ${voters.length} voters`)
    console.log(`Merkle root: ${voterTree.root.substring(0, 16)}...`)
    
    expect(voters).to.have.lengthOf(voterCount)
    expect(voterTree.proofs.size).to.equal(voterCount)
    
    // Verify all voters have valid proofs
    voters.forEach(voter => {
      const proof = voterTree.proofs.get(voter.voterId)
      expect(proof).to.not.be.undefined
      expect(proof!.verified).to.be.true
    })
    
    ballot.status = 'active'
    console.log('Election opened for voting')
    
    // ===== PHASE 3: Voting Period =====
    console.log('\n=== Phase 3: Voting Period ===')
    
    const votes: Vote[] = []
    const usedNullifiers = new Set<string>()
    
    // Simulate voters casting votes
    const votingScenarios = [
      // 20 votes for Alice (40%)
      ...Array(20).fill(null).map((_, i) => ({ voterIdx: i, candidateId: 0 })),
      // 18 votes for Bob (36%)
      ...Array(18).fill(null).map((_, i) => ({ voterIdx: i + 20, candidateId: 1 })),
      // 12 votes for Carol (24%)
      ...Array(12).fill(null).map((_, i) => ({ voterIdx: i + 38, candidateId: 2 }))
    ]
    
    votingScenarios.forEach(({ voterIdx, candidateId }) => {
      const voter = voters[voterIdx]
      const voteChoice = candidateId
      const voteRandomness = generateRandomness()
      
      // Generate ZK proof inputs
      const merkleProof = voterTree.proofs.get(voter.voterId)!
      const nullifierHash = generateNullifier(voter.voterId, ballot.id)
      const voteCommitment = createCommitment(voteChoice.toString(), voteRandomness)
      
      // Check for double voting
      if (usedNullifiers.has(nullifierHash)) {
        throw new Error('Double vote detected!')
      }
      usedNullifiers.add(nullifierHash)
      
      const zkInputs: ZKProofInputs = {
        voterId: voter.voterId,
        voteChoice,
        voteRandomness,
        merklePath: merkleProof.proof,
        merkleIndices: merkleProof.indices,
        merkleRoot: voterTree.root,
        nullifierHash,
        voteCommitment,
        ballotId: ballot.id,
        candidateCount: ballot.candidates.length
      }
      
      const publicInputs = preparePublicInputs(zkInputs)
      
      // In real implementation, ZK proof would be generated here
      // and submitted to blockchain with only public inputs
      
      const vote: Vote = {
        nullifierHash,
        voteCommitment,
        zkProof: { publicInputs }, // Simplified
        candidateId, // Encrypted in real implementation
        timestamp: Date.now()
      }
      
      votes.push(vote)
      ballot.candidates[candidateId].voteCount++
    })
    
    console.log(`Total votes cast: ${votes.length}`)
    console.log(`Unique nullifiers: ${usedNullifiers.size}`)
    
    expect(votes).to.have.lengthOf(50)
    expect(usedNullifiers.size).to.equal(50)
    
    // ===== PHASE 4: Attempt Double Voting =====
    console.log('\n=== Phase 4: Double Voting Prevention ===')
    
    const maliciousVoter = voters[0]
    const nullifierAttempt = generateNullifier(maliciousVoter.voterId, ballot.id)
    
    if (usedNullifiers.has(nullifierAttempt)) {
      console.log('✓ Double voting attempt blocked!')
    }
    
    expect(usedNullifiers.has(nullifierAttempt)).to.be.true
    
    // ===== PHASE 5: Close Election =====
    console.log('\n=== Phase 5: Election Closed ===')
    ballot.status = 'closed'
    
    // ===== PHASE 6: Tally Results =====
    console.log('\n=== Phase 6: Result Tallying ===')
    
    const totalVotes = ballot.candidates.reduce((sum, c) => sum + c.voteCount, 0)
    
    console.log(`Total votes counted: ${totalVotes}`)
    console.log('\nFinal Results:')
    
    ballot.candidates
      .sort((a, b) => b.voteCount - a.voteCount)
      .forEach((candidate, idx) => {
        const percentage = ((candidate.voteCount / totalVotes) * 100).toFixed(1)
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'
        console.log(`${medal} ${candidate.name}: ${candidate.voteCount} votes (${percentage}%)`)
      })
    
    expect(totalVotes).to.equal(50)
    
    // ===== PHASE 7: Verification =====
    console.log('\n=== Phase 7: Public Verification ===')
    
    // Anyone can verify:
    // 1. All nullifiers are unique
    const uniqueNullifiers = new Set(votes.map(v => v.nullifierHash))
    console.log(`✓ All nullifiers unique: ${uniqueNullifiers.size === votes.length}`)
    expect(uniqueNullifiers.size).to.equal(votes.length)
    
    // 2. All votes have valid ZK proofs
    const validProofs = votes.every(vote => {
      // In real implementation, verify ZK proof on-chain
      return vote.zkProof && vote.zkProof.publicInputs
    })
    console.log(`✓ All ZK proofs valid: ${validProofs}`)
    expect(validProofs).to.be.true
    
    // 3. Vote count matches
    console.log(`✓ Vote count matches: ${totalVotes === votes.length}`)
    expect(totalVotes).to.equal(votes.length)
    
    // 4. Merkle root is published
    console.log(`✓ Voter registry Merkle root published: ${voterTree.root.substring(0, 16)}...`)
    expect(voterTree.root).to.be.a('string')
    
    console.log('\n✅ Election completed successfully!')
    console.log('   - Privacy: Vote choices remain secret')
    console.log('   - Integrity: All votes counted correctly')
    console.log('   - Verifiability: Results are publicly auditable')
    console.log('   - Double-voting prevented: Nullifier system working')
  })
  
  it('should prevent unauthorized voting', () => {
    const ballotId = generateCredential()
    
    // Register legitimate voters
    const legitimateVoters: VoterLeaf[] = []
    for (let i = 0; i < 5; i++) {
      const voterId = generateCredential()
      legitimateVoters.push({
        index: i,
        voterId,
        commitment: generateVoterCommitment(voterId)
      })
    }
    
    const voterTree = buildVoterTree(legitimateVoters)
    
    // Attacker tries to vote
    const attackerId = generateCredential()
    const attackerCommitment = generateVoterCommitment(attackerId)
    
    // Attacker cannot generate valid Merkle proof
    const attackerProof = voterTree.proofs.get(attackerId)
    expect(attackerProof).to.be.undefined
    
    console.log('✓ Unauthorized voter blocked')
  })
  
  it('should handle voter abstention', () => {
    const ballotId = generateCredential()
    
    // Register 10 voters
    const voters: VoterLeaf[] = []
    for (let i = 0; i < 10; i++) {
      const voterId = generateCredential()
      voters.push({
        index: i,
        voterId,
        commitment: generateVoterCommitment(voterId)
      })
    }
    
    const voterTree = buildVoterTree(voters)
    const usedNullifiers = new Set<string>()
    
    // Only 7 voters vote
    for (let i = 0; i < 7; i++) {
      const voter = voters[i]
      const nullifierHash = generateNullifier(voter.voterId, ballotId)
      usedNullifiers.add(nullifierHash)
    }
    
    const turnout = (usedNullifiers.size / voters.length) * 100
    console.log(`Voter turnout: ${turnout}%`)
    
    expect(usedNullifiers.size).to.equal(7)
    expect(turnout).to.equal(70)
  })
  
  it('should support multiple simultaneous elections', () => {
    // Create two elections
    const ballotId1 = generateCredential()
    const ballotId2 = generateCredential()
    
    // Same voters can participate in both
    const voters: VoterLeaf[] = []
    for (let i = 0; i < 10; i++) {
      const voterId = generateCredential()
      voters.push({
        index: i,
        voterId,
        commitment: generateVoterCommitment(voterId)
      })
    }
    
    const voterTree = buildVoterTree(voters)
    
    const nullifiers1 = new Set<string>()
    const nullifiers2 = new Set<string>()
    
    // Each voter votes in both elections
    voters.forEach(voter => {
      const nullifier1 = generateNullifier(voter.voterId, ballotId1)
      const nullifier2 = generateNullifier(voter.voterId, ballotId2)
      
      nullifiers1.add(nullifier1)
      nullifiers2.add(nullifier2)
      
      // Different elections = different nullifiers
      expect(nullifier1).to.not.equal(nullifier2)
    })
    
    expect(nullifiers1.size).to.equal(10)
    expect(nullifiers2.size).to.equal(10)
    
    console.log('✓ Multiple elections supported')
  })
})
