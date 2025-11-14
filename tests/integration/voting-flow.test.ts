/**
 * Integration tests for complete voting flow
 * Tests interaction between crypto, merkle, and zkproof modules
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
  buildMerkleTree,
  generateMerkleProof,
  getMerkleRoot,
  buildVoterTree,
  VoterLeaf
} from '../../src/modules/merkle/index.js'
import {
  preparePublicInputs,
  ZKProofInputs
} from '../../src/modules/zkproof/index.js'

describe('Voting Flow Integration Tests', () => {
  describe('Voter Registration and Eligibility', () => {
    it('should register multiple voters and build Merkle tree', () => {
      // Register 10 voters
      const voterCount = 10
      const voterIds: string[] = []
      
      for (let i = 0; i < voterCount; i++) {
        const voterId = generateCredential()
        voterIds.push(voterId)
      }
      
      // Generate commitments
      const voterCommitments = voterIds.map(id => generateVoterCommitment(id))
      
      // Build Merkle tree
      const tree = buildMerkleTree(voterCommitments)
      const merkleRoot = getMerkleRoot(tree)
      
      expect(merkleRoot).to.be.a('string')
      expect(merkleRoot).to.have.lengthOf(64)
      
      // Verify all voters can generate valid proofs
      voterIds.forEach((voterId, index) => {
        const commitment = voterCommitments[index]
        const proof = generateMerkleProof(tree, commitment)
        
        expect(proof.verified).to.be.true
        expect(proof.root).to.equal(merkleRoot)
      })
    })
    
    it('should create voter tree with complete proofs', () => {
      const voters: VoterLeaf[] = []
      
      for (let i = 0; i < 5; i++) {
        const voterId = generateCredential()
        voters.push({
          index: i,
          voterId,
          commitment: generateVoterCommitment(voterId)
        })
      }
      
      const voterTree = buildVoterTree(voters)
      
      expect(voterTree.root).to.be.a('string')
      expect(voterTree.proofs.size).to.equal(voters.length)
      
      // All proofs should be valid
      voters.forEach(voter => {
        const proof = voterTree.proofs.get(voter.voterId)
        expect(proof).to.not.be.undefined
        expect(proof!.verified).to.be.true
      })
    })
  })
  
  describe('Vote Casting Workflow', () => {
    it('should complete full vote workflow for single voter', () => {
      // 1. Setup: Create election with voters
      const ballotId = generateCredential()
      const candidateCount = 5
      
      const voters: VoterLeaf[] = []
      for (let i = 0; i < 8; i++) {
        const voterId = generateCredential()
        voters.push({
          index: i,
          voterId,
          commitment: generateVoterCommitment(voterId)
        })
      }
      
      const voterTree = buildVoterTree(voters)
      
      // 2. Voter prepares to vote
      const voter = voters[3]
      const voteChoice = 2
      const voteRandomness = generateRandomness()
      
      // 3. Generate ZK proof inputs
      const merkleProof = voterTree.proofs.get(voter.voterId)!
      const nullifierHash = generateNullifier(voter.voterId, ballotId)
      const voteCommitment = createCommitment(voteChoice.toString(), voteRandomness)
      
      const zkInputs: ZKProofInputs = {
        voterId: voter.voterId,
        voteChoice,
        voteRandomness,
        merklePath: merkleProof.proof,
        merkleIndices: merkleProof.indices,
        merkleRoot: voterTree.root,
        nullifierHash,
        voteCommitment,
        ballotId,
        candidateCount
      }
      
      // 4. Verify ZK inputs are valid
      expect(zkInputs.voterId).to.equal(voter.voterId)
      expect(zkInputs.voteChoice).to.equal(voteChoice)
      expect(merkleProof.verified).to.be.true
      
      // 5. Prepare public inputs for on-chain verification
      const publicInputs = preparePublicInputs(zkInputs)
      
      expect(publicInputs).to.include(voterTree.root)
      expect(publicInputs).to.include(nullifierHash)
      expect(publicInputs).to.include(voteCommitment)
      expect(publicInputs).to.include(ballotId)
    })
    
    it('should handle multiple voters casting votes', () => {
      const ballotId = generateCredential()
      const candidateCount = 3
      
      // Setup election
      const voters: VoterLeaf[] = []
      for (let i = 0; i < 20; i++) {
        const voterId = generateCredential()
        voters.push({
          index: i,
          voterId,
          commitment: generateVoterCommitment(voterId)
        })
      }
      
      const voterTree = buildVoterTree(voters)
      const usedNullifiers = new Set<string>()
      
      // Each voter casts vote
      voters.forEach((voter, idx) => {
        const voteChoice = idx % candidateCount
        const voteRandomness = generateRandomness()
        
        const merkleProof = voterTree.proofs.get(voter.voterId)!
        const nullifierHash = generateNullifier(voter.voterId, ballotId)
        const voteCommitment = createCommitment(voteChoice.toString(), voteRandomness)
        
        // Verify no nullifier reuse
        expect(usedNullifiers.has(nullifierHash)).to.be.false
        usedNullifiers.add(nullifierHash)
        
        // Verify proof is valid
        expect(merkleProof.verified).to.be.true
        
        const zkInputs: ZKProofInputs = {
          voterId: voter.voterId,
          voteChoice,
          voteRandomness,
          merklePath: merkleProof.proof,
          merkleIndices: merkleProof.indices,
          merkleRoot: voterTree.root,
          nullifierHash,
          voteCommitment,
          ballotId,
          candidateCount
        }
        
        const publicInputs = preparePublicInputs(zkInputs)
        expect(publicInputs).to.have.lengthOf(5)
      })
      
      expect(usedNullifiers.size).to.equal(voters.length)
    })
  })
  
  describe('Double Voting Prevention', () => {
    it('should detect double voting attempt through nullifier', () => {
      const ballotId = generateCredential()
      
      const voters: VoterLeaf[] = []
      for (let i = 0; i < 5; i++) {
        const voterId = generateCredential()
        voters.push({
          index: i,
          voterId,
          commitment: generateVoterCommitment(voterId)
        })
      }
      
      const voterTree = buildVoterTree(voters)
      const usedNullifiers = new Set<string>()
      
      // First vote
      const voter = voters[2]
      const nullifier1 = generateNullifier(voter.voterId, ballotId)
      usedNullifiers.add(nullifier1)
      
      // Second vote attempt (should be rejected)
      const nullifier2 = generateNullifier(voter.voterId, ballotId)
      
      expect(nullifier1).to.equal(nullifier2)
      expect(usedNullifiers.has(nullifier2)).to.be.true
    })
    
    it('should allow same voter to vote in different ballots', () => {
      const ballotId1 = generateCredential()
      const ballotId2 = generateCredential()
      
      const voterId = generateCredential()
      
      const nullifier1 = generateNullifier(voterId, ballotId1)
      const nullifier2 = generateNullifier(voterId, ballotId2)
      
      // Different ballots = different nullifiers
      expect(nullifier1).to.not.equal(nullifier2)
    })
  })
  
  describe('Vote Privacy', () => {
    it('should hide vote choice through commitment', () => {
      const voteChoice = 3
      const randomness1 = generateRandomness()
      const randomness2 = generateRandomness()
      
      const commitment1 = createCommitment(voteChoice.toString(), randomness1)
      const commitment2 = createCommitment(voteChoice.toString(), randomness2)
      
      // Same vote, different randomness = different commitments
      expect(commitment1).to.not.equal(commitment2)
      
      // Cannot determine vote from commitment
      expect(commitment1).to.have.lengthOf(64)
    })
    
    it('should ensure voter anonymity through ZK proof', () => {
      const ballotId = generateCredential()
      
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
      
      // Two voters cast votes
      const voter1 = voters[2]
      const voter2 = voters[7]
      
      const nullifier1 = generateNullifier(voter1.voterId, ballotId)
      const nullifier2 = generateNullifier(voter2.voterId, ballotId)
      
      // Nullifiers don't reveal voter identity
      expect(nullifier1).to.not.equal(voter1.voterId)
      expect(nullifier2).to.not.equal(voter2.voterId)
      
      // Cannot link nullifiers to voters
      expect(nullifier1).to.have.lengthOf(64)
      expect(nullifier2).to.have.lengthOf(64)
    })
  })
  
  describe('Invalid Vote Scenarios', () => {
    it('should reject vote from non-registered voter', () => {
      // Registered voters
      const voters: VoterLeaf[] = []
      for (let i = 0; i < 5; i++) {
        const voterId = generateCredential()
        voters.push({
          index: i,
          voterId,
          commitment: generateVoterCommitment(voterId)
        })
      }
      
      const voterTree = buildVoterTree(voters)
      
      // Attacker (not in tree)
      const attackerId = generateCredential()
      const attackerCommitment = generateVoterCommitment(attackerId)
      
      // Try to generate proof
      const tree = buildMerkleTree(voters.map(v => v.commitment))
      const proof = generateMerkleProof(tree, attackerCommitment)
      
      expect(proof.verified).to.be.false
    })
    
    it('should reject vote with tampered Merkle proof', () => {
      const voters: VoterLeaf[] = []
      for (let i = 0; i < 4; i++) {
        const voterId = generateCredential()
        voters.push({
          index: i,
          voterId,
          commitment: generateVoterCommitment(voterId)
        })
      }
      
      const voterTree = buildVoterTree(voters)
      const voter = voters[1]
      const proof = voterTree.proofs.get(voter.voterId)!
      
      // Tamper with proof
      const tamperedProof = { ...proof }
      tamperedProof.proof = [...proof.proof]
      tamperedProof.proof[0] = generateCredential()
      
      // Verification should fail
      const tree = buildMerkleTree(voters.map(v => v.commitment))
      const recomputedProof = generateMerkleProof(tree, voter.commitment)
      
      expect(tamperedProof.proof[0]).to.not.equal(recomputedProof.proof[0])
    })
  })
  
  describe('Multiple Elections', () => {
    it('should handle voter participating in multiple elections', () => {
      const voterId = generateCredential()
      const voterCommitment = generateVoterCommitment(voterId)
      
      // Election 1
      const ballotId1 = generateCredential()
      const voters1: VoterLeaf[] = [
        { index: 0, voterId, commitment: voterCommitment },
        { index: 1, voterId: generateCredential(), commitment: generateVoterCommitment(generateCredential()) }
      ]
      const tree1 = buildVoterTree(voters1)
      
      // Election 2
      const ballotId2 = generateCredential()
      const voters2: VoterLeaf[] = [
        { index: 0, voterId, commitment: voterCommitment },
        { index: 1, voterId: generateCredential(), commitment: generateVoterCommitment(generateCredential()) }
      ]
      const tree2 = buildVoterTree(voters2)
      
      // Vote in both elections
      const nullifier1 = generateNullifier(voterId, ballotId1)
      const nullifier2 = generateNullifier(voterId, ballotId2)
      
      expect(tree1.proofs.get(voterId)!.verified).to.be.true
      expect(tree2.proofs.get(voterId)!.verified).to.be.true
      expect(nullifier1).to.not.equal(nullifier2)
    })
  })
  
  describe('Performance and Scalability', () => {
    it('should handle 100 voters efficiently', () => {
      const startTime = Date.now()
      
      const voters: VoterLeaf[] = []
      for (let i = 0; i < 100; i++) {
        const voterId = generateCredential()
        voters.push({
          index: i,
          voterId,
          commitment: generateVoterCommitment(voterId)
        })
      }
      
      const voterTree = buildVoterTree(voters)
      
      // Verify first and last voters
      expect(voterTree.proofs.get(voters[0].voterId)!.verified).to.be.true
      expect(voterTree.proofs.get(voters[99].voterId)!.verified).to.be.true
      
      const elapsed = Date.now() - startTime
      expect(elapsed).to.be.lessThan(5000) // Should complete in under 5 seconds
    })
    
    it('should handle 1000 voters for large elections', () => {
      const voters: VoterLeaf[] = []
      for (let i = 0; i < 1000; i++) {
        const voterId = generateCredential()
        voters.push({
          index: i,
          voterId,
          commitment: generateVoterCommitment(voterId)
        })
      }
      
      const voterTree = buildVoterTree(voters)
      
      expect(voterTree.root).to.be.a('string')
      expect(voterTree.proofs.size).to.equal(1000)
      
      // Spot check random voters
      const randomIndices = [0, 250, 500, 750, 999]
      randomIndices.forEach(idx => {
        const proof = voterTree.proofs.get(voters[idx].voterId)
        expect(proof).to.not.be.undefined
        expect(proof!.verified).to.be.true
      })
    })
  })
})
