/**
 * Unit tests for ZK Proof module
 * 
 * Note: These tests use mocked ZoKrates functionality
 * For full integration tests, compile actual ZK circuits
 */

import { expect } from 'chai'
import {
  serializeProof,
  deserializeProof,
  preparePublicInputs,
  computeProofHash,
  ZKProof,
  ZKProofInputs
} from '../../src/modules/zkproof/index.js'
import { generateCredential, generateNullifier, createCommitment, generateRandomness } from '../../src/modules/crypto/index.js'
import { buildMerkleTree, generateMerkleProof } from '../../src/modules/merkle/index.js'

describe('ZK Proof Module', () => {
  describe('Proof Serialization', () => {
    let mockProof: ZKProof
    
    beforeEach(() => {
      mockProof = {
        proof: {
          a: ['0x1234', '0x5678'],
          b: [['0xaaaa', '0xbbbb'], ['0xcccc', '0xdddd']],
          c: ['0xeeee', '0xffff']
        },
        inputs: ['0x111111', '0x222222', '0x333333']
      }
    })
    
    it('should serialize proof to JSON string', () => {
      const serialized = serializeProof(mockProof)
      
      expect(serialized).to.be.a('string')
      expect(() => JSON.parse(serialized)).to.not.throw()
    })
    
    it('should deserialize proof from JSON string', () => {
      const serialized = serializeProof(mockProof)
      const deserialized = deserializeProof(serialized)
      
      expect(deserialized).to.deep.equal(mockProof)
    })
    
    it('should preserve proof structure after serialize/deserialize', () => {
      const serialized = serializeProof(mockProof)
      const deserialized = deserializeProof(serialized)
      
      expect(deserialized.proof.a).to.deep.equal(mockProof.proof.a)
      expect(deserialized.proof.b).to.deep.equal(mockProof.proof.b)
      expect(deserialized.proof.c).to.deep.equal(mockProof.proof.c)
      expect(deserialized.inputs).to.deep.equal(mockProof.inputs)
    })
  })
  
  describe('Public Inputs Preparation', () => {
    it('should prepare public inputs from ZKProofInputs', () => {
      const inputs: ZKProofInputs = {
        voterId: generateCredential(),
        voteChoice: 2,
        voteRandomness: generateRandomness(),
        merklePath: ['0x1111', '0x2222', '0x3333'],
        merkleIndices: 5n,
        merkleRoot: generateCredential(),
        nullifierHash: generateCredential(),
        voteCommitment: generateCredential(),
        ballotId: generateCredential(),
        candidateCount: 5
      }
      
      const publicInputs = preparePublicInputs(inputs)
      
      expect(publicInputs).to.be.an('array')
      expect(publicInputs).to.have.lengthOf(5)
      expect(publicInputs[0]).to.equal(inputs.merkleRoot)
      expect(publicInputs[1]).to.equal(inputs.nullifierHash)
      expect(publicInputs[2]).to.equal(inputs.voteCommitment)
      expect(publicInputs[3]).to.equal(inputs.ballotId)
      expect(publicInputs[4]).to.equal(inputs.candidateCount.toString())
    })
    
    it('should only include public inputs, not private ones', () => {
      const inputs: ZKProofInputs = {
        voterId: generateCredential(),
        voteChoice: 7,
        voteRandomness: generateRandomness(),
        merklePath: ['0x1111'],
        merkleIndices: 0n,
        merkleRoot: generateCredential(),
        nullifierHash: generateCredential(),
        voteCommitment: generateCredential(),
        ballotId: generateCredential(),
        candidateCount: 3
      }
      
      const publicInputs = preparePublicInputs(inputs)
      
      // Should not include full private inputs
      expect(publicInputs).to.not.include(inputs.voterId)
      expect(publicInputs).to.not.include(inputs.voteRandomness)
      
      // Should include public inputs
      expect(publicInputs).to.include(inputs.merkleRoot)
      expect(publicInputs).to.include(inputs.nullifierHash)
      expect(publicInputs).to.include(inputs.voteCommitment)
      expect(publicInputs).to.include(inputs.ballotId)
    })
  })
  
  describe('Proof Hashing', () => {
    it('should compute consistent hash for same proof', () => {
      const proof: ZKProof = {
        proof: {
          a: ['0x1234', '0x5678'],
          b: [['0xaaaa', '0xbbbb'], ['0xcccc', '0xdddd']],
          c: ['0xeeee', '0xffff']
        },
        inputs: ['0x111111', '0x222222']
      }
      
      const hash1 = computeProofHash(proof)
      const hash2 = computeProofHash(proof)
      
      expect(hash1).to.equal(hash2)
    })
    
    it('should compute different hashes for different proofs', () => {
      const proof1: ZKProof = {
        proof: {
          a: ['0x1234', '0x5678'],
          b: [['0xaaaa', '0xbbbb'], ['0xcccc', '0xdddd']],
          c: ['0xeeee', '0xffff']
        },
        inputs: ['0x111111']
      }
      
      const proof2: ZKProof = {
        proof: {
          a: ['0x9999', '0x8888'],
          b: [['0xaaaa', '0xbbbb'], ['0xcccc', '0xdddd']],
          c: ['0xeeee', '0xffff']
        },
        inputs: ['0x111111']
      }
      
      const hash1 = computeProofHash(proof1)
      const hash2 = computeProofHash(proof2)
      
      expect(hash1).to.not.equal(hash2)
    })
    
    it('should produce 32-byte hash', () => {
      const proof: ZKProof = {
        proof: {
          a: ['0x1234'],
          b: [['0xaaaa']],
          c: ['0xeeee']
        },
        inputs: ['0x111111']
      }
      
      const hash = computeProofHash(proof)
      
      expect(hash).to.have.lengthOf(64) // 32 bytes hex
    })
  })
  
  describe('ZK Proof Input Structure', () => {
    it('should validate ZKProofInputs structure', () => {
      const voterId = generateCredential()
      const ballotId = generateCredential()
      const voteChoice = 1
      const voteRandomness = generateRandomness()
      
      // Generate Merkle proof for voter
      const voterCommitments = [
        generateCredential(),
        generateCredential(),
        voterId, // Voter is in the list
        generateCredential()
      ]
      const tree = buildMerkleTree(voterCommitments)
      const merkleProof = generateMerkleProof(tree, voterId)
      
      // Create ZK inputs
      const nullifierHash = generateNullifier(voterId, ballotId)
      const voteCommitment = createCommitment(voteChoice.toString(), voteRandomness)
      
      const zkInputs: ZKProofInputs = {
        // Private
        voterId,
        voteChoice,
        voteRandomness,
        merklePath: merkleProof.proof,
        merkleIndices: merkleProof.indices,
        // Public
        merkleRoot: merkleProof.root,
        nullifierHash,
        voteCommitment,
        ballotId,
        candidateCount: 5
      }
      
      // Verify structure
      expect(zkInputs.voterId).to.be.a('string')
      expect(zkInputs.voteChoice).to.be.a('number')
      expect(zkInputs.voteRandomness).to.be.a('string')
      expect(zkInputs.merklePath).to.be.an('array')
      expect(zkInputs.merkleIndices).to.be.a('bigint')
      expect(zkInputs.merkleRoot).to.be.a('string')
      expect(zkInputs.nullifierHash).to.be.a('string')
      expect(zkInputs.voteCommitment).to.be.a('string')
      expect(zkInputs.ballotId).to.be.a('string')
      expect(zkInputs.candidateCount).to.be.a('number')
    })
    
    it('should correctly compute nullifier and commitment', () => {
      const voterId = generateCredential()
      const ballotId = generateCredential()
      const voteChoice = 2
      const voteRandomness = generateRandomness()
      
      const nullifierHash = generateNullifier(voterId, ballotId)
      const voteCommitment = createCommitment(voteChoice.toString(), voteRandomness)
      
      // Nullifier should be deterministic
      const nullifierHash2 = generateNullifier(voterId, ballotId)
      expect(nullifierHash).to.equal(nullifierHash2)
      
      // Commitment should be deterministic with same randomness
      const voteCommitment2 = createCommitment(voteChoice.toString(), voteRandomness)
      expect(voteCommitment).to.equal(voteCommitment2)
    })
  })
  
  describe('ZK Circuit Constraints (Conceptual)', () => {
    it('should verify nullifier prevents double voting', () => {
      const voterId = generateCredential()
      const ballotId1 = generateCredential()
      const ballotId2 = generateCredential()
      
      const nullifier1 = generateNullifier(voterId, ballotId1)
      const nullifier2 = generateNullifier(voterId, ballotId2)
      
      // Same voter, different ballots = different nullifiers
      expect(nullifier1).to.not.equal(nullifier2)
      
      // Same voter, same ballot = same nullifier (would be rejected)
      const nullifier1Again = generateNullifier(voterId, ballotId1)
      expect(nullifier1).to.equal(nullifier1Again)
    })
    
    it('should verify commitment hides vote choice', () => {
      const voteChoice1 = 0
      const voteChoice2 = 1
      const randomness = generateRandomness()
      
      const commitment1 = createCommitment(voteChoice1.toString(), randomness)
      const commitment2 = createCommitment(voteChoice2.toString(), randomness)
      
      // Different votes with same randomness = different commitments
      expect(commitment1).to.not.equal(commitment2)
      
      // But you can't determine vote from commitment alone
      expect(commitment1).to.have.lengthOf(64)
      expect(commitment2).to.have.lengthOf(64)
    })
    
    it('should verify Merkle proof validates voter eligibility', () => {
      const voterIds = [
        generateCredential(),
        generateCredential(),
        generateCredential(),
        generateCredential()
      ]
      
      const tree = buildMerkleTree(voterIds)
      const root = tree.getRoot().toString('hex')
      
      // Valid voter
      const validProof = generateMerkleProof(tree, voterIds[2])
      expect(validProof.verified).to.be.true
      expect(validProof.root).to.equal(root)
      
      // Invalid voter (not in tree)
      const invalidVoter = generateCredential()
      const invalidProof = generateMerkleProof(tree, invalidVoter)
      expect(invalidProof.verified).to.be.false
    })
  })
  
  describe('Vote Proof Workflow', () => {
    it('should create complete vote proof inputs', () => {
      // Setup: Register voters
      const voters = [
        generateCredential(),
        generateCredential(),
        generateCredential(),
        generateCredential()
      ]
      const tree = buildMerkleTree(voters)
      const merkleRoot = tree.getRoot().toString('hex')
      
      // Voter wants to vote
      const voterId = voters[1]
      const ballotId = generateCredential()
      const voteChoice = 2
      const candidateCount = 5
      
      // Generate proof inputs
      const merkleProof = generateMerkleProof(tree, voterId)
      const voteRandomness = generateRandomness()
      const nullifierHash = generateNullifier(voterId, ballotId)
      const voteCommitment = createCommitment(voteChoice.toString(), voteRandomness)
      
      const zkInputs: ZKProofInputs = {
        voterId,
        voteChoice,
        voteRandomness,
        merklePath: merkleProof.proof,
        merkleIndices: merkleProof.indices,
        merkleRoot,
        nullifierHash,
        voteCommitment,
        ballotId,
        candidateCount
      }
      
      // Verify inputs are valid
      expect(zkInputs.voterId).to.equal(voterId)
      expect(zkInputs.voteChoice).to.equal(voteChoice)
      expect(merkleProof.verified).to.be.true
      expect(zkInputs.merkleRoot).to.equal(merkleRoot)
      
      // Public inputs for verification
      const publicInputs = preparePublicInputs(zkInputs)
      expect(publicInputs).to.include(merkleRoot)
      expect(publicInputs).to.include(nullifierHash)
      expect(publicInputs).to.include(voteCommitment)
    })
    
    it('should reject vote with invalid Merkle proof', () => {
      const voters = [
        generateCredential(),
        generateCredential()
      ]
      const tree = buildMerkleTree(voters)
      
      // Attacker tries to vote without being in registry
      const attackerVoterId = generateCredential()
      const merkleProof = generateMerkleProof(tree, attackerVoterId)
      
      expect(merkleProof.verified).to.be.false
    })
    
    it('should detect double voting attempt via nullifier', () => {
      const voterId = generateCredential()
      const ballotId = generateCredential()
      
      // First vote
      const nullifier1 = generateNullifier(voterId, ballotId)
      
      // Second vote attempt (same voter, same ballot)
      const nullifier2 = generateNullifier(voterId, ballotId)
      
      // Nullifiers should match, indicating double vote
      expect(nullifier1).to.equal(nullifier2)
      
      // In real implementation, nullifier1 would be stored on-chain
      // and nullifier2 would be rejected as duplicate
    })
  })
  
  describe('Edge Cases', () => {
    it('should handle maximum candidate index', () => {
      const maxCandidates = 100
      const voteChoice = maxCandidates - 1
      const randomness = generateRandomness()
      
      const commitment = createCommitment(voteChoice.toString(), randomness)
      expect(commitment).to.be.a('string')
      expect(commitment).to.have.lengthOf(64)
    })
    
    it('should handle minimum inputs', () => {
      const inputs: ZKProofInputs = {
        voterId: generateCredential(),
        voteChoice: 0,
        voteRandomness: generateRandomness(),
        merklePath: [],
        merkleIndices: 0n,
        merkleRoot: generateCredential(),
        nullifierHash: generateCredential(),
        voteCommitment: generateCredential(),
        ballotId: generateCredential(),
        candidateCount: 1
      }
      
      const publicInputs = preparePublicInputs(inputs)
      expect(publicInputs).to.have.lengthOf(5)
    })
    
    it('should handle large Merkle trees', () => {
      const voterCount = 1000
      const voters = Array(voterCount).fill(0).map(() => generateCredential())
      
      const tree = buildMerkleTree(voters)
      const merkleRoot = tree.getRoot().toString('hex')
      
      const randomVoter = voters[Math.floor(Math.random() * voterCount)]
      const proof = generateMerkleProof(tree, randomVoter)
      
      expect(proof.verified).to.be.true
      expect(proof.proof.length).to.be.greaterThan(0)
    })
  })
})
