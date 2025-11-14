/**
 * Unit tests for Merkle Tree module
 */

import { expect } from 'chai'
import {
  buildMerkleTree,
  getMerkleRoot,
  generateMerkleProof,
  verifyMerkleProof,
  getLeafIndex,
  getLeaves,
  exportTree,
  importTree,
  buildVoterTree,
  SparseMerkleTree,
  MerkleProof,
  VoterLeaf
} from '../../src/modules/merkle/index.js'
import { generateVoterCommitment, generateCredential } from '../../src/modules/crypto/index.js'

describe('Merkle Tree Module', () => {
  describe('Basic Merkle Tree', () => {
    let voterCommitments: string[]
    
    beforeEach(() => {
      // Create sample voter commitments
      voterCommitments = [
        generateVoterCommitment(generateCredential()),
        generateVoterCommitment(generateCredential()),
        generateVoterCommitment(generateCredential()),
        generateVoterCommitment(generateCredential())
      ]
    })
    
    it('should build Merkle tree from commitments', () => {
      const tree = buildMerkleTree(voterCommitments)
      expect(tree).to.not.be.null
      expect(tree.getDepth()).to.be.greaterThan(0)
    })
    
    it('should get Merkle root', () => {
      const tree = buildMerkleTree(voterCommitments)
      const root = getMerkleRoot(tree)
      
      expect(root).to.be.a('string')
      expect(root).to.have.lengthOf(64)
    })
    
    it('should produce consistent roots', () => {
      const tree1 = buildMerkleTree(voterCommitments)
      const tree2 = buildMerkleTree(voterCommitments)
      
      expect(getMerkleRoot(tree1)).to.equal(getMerkleRoot(tree2))
    })
    
    it('should produce different roots for different leaves', () => {
      const tree1 = buildMerkleTree(voterCommitments)
      
      const differentCommitments = [
        generateVoterCommitment(generateCredential()),
        generateVoterCommitment(generateCredential())
      ]
      const tree2 = buildMerkleTree(differentCommitments)
      
      expect(getMerkleRoot(tree1)).to.not.equal(getMerkleRoot(tree2))
    })
  })
  
  describe('Merkle Proofs', () => {
    let tree: any
    let voterCommitments: string[]
    
    beforeEach(() => {
      voterCommitments = [
        generateVoterCommitment(generateCredential()),
        generateVoterCommitment(generateCredential()),
        generateVoterCommitment(generateCredential()),
        generateVoterCommitment(generateCredential()),
        generateVoterCommitment(generateCredential()),
        generateVoterCommitment(generateCredential()),
        generateVoterCommitment(generateCredential()),
        generateVoterCommitment(generateCredential())
      ]
      tree = buildMerkleTree(voterCommitments)
    })
    
    it('should generate valid Merkle proof', () => {
      const voterCommitment = voterCommitments[2]
      const proof = generateMerkleProof(tree, voterCommitment)
      
      expect(proof).to.have.property('leaf')
      expect(proof).to.have.property('root')
      expect(proof).to.have.property('proof')
      expect(proof).to.have.property('indices')
      expect(proof.verified).to.be.true
    })
    
    it('should verify valid Merkle proof', () => {
      const voterCommitment = voterCommitments[3]
      const proof = generateMerkleProof(tree, voterCommitment)
      
      const isValid = verifyMerkleProof(
        proof.leaf,
        proof.proof,
        proof.indices,
        proof.root
      )
      
      expect(isValid).to.be.true
    })
    
    it('should reject invalid Merkle proof', () => {
      const voterCommitment = voterCommitments[0]
      const proof = generateMerkleProof(tree, voterCommitment)
      
      // Tamper with proof
      proof.proof[0] = generateCredential()
      
      const isValid = verifyMerkleProof(
        proof.leaf,
        proof.proof,
        proof.indices,
        proof.root
      )
      
      expect(isValid).to.be.false
    })
    
    it('should generate proofs for all leaves', () => {
      voterCommitments.forEach((commitment, index) => {
        const proof = generateMerkleProof(tree, commitment)
        expect(proof.verified).to.be.true
      })
    })
  })
  
  describe('Tree Operations', () => {
    let tree: any
    let voterCommitments: string[]
    
    beforeEach(() => {
      voterCommitments = [
        generateVoterCommitment(generateCredential()),
        generateVoterCommitment(generateCredential()),
        generateVoterCommitment(generateCredential()),
        generateVoterCommitment(generateCredential())
      ]
      tree = buildMerkleTree(voterCommitments)
    })
    
    it('should get leaf index', () => {
      const commitment = voterCommitments[1]
      const index = getLeafIndex(tree, commitment)
      
      expect(index).to.equal(1)
    })
    
    it('should return -1 for non-existent leaf', () => {
      const nonExistent = generateVoterCommitment(generateCredential())
      const index = getLeafIndex(tree, nonExistent)
      
      expect(index).to.equal(-1)
    })
    
    it('should get all leaves', () => {
      const leaves = getLeaves(tree)
      
      expect(leaves).to.be.an('array')
      expect(leaves).to.have.lengthOf(voterCommitments.length)
    })
  })
  
  describe('Tree Serialization', () => {
    let tree: any
    let voterCommitments: string[]
    
    beforeEach(() => {
      voterCommitments = [
        generateVoterCommitment(generateCredential()),
        generateVoterCommitment(generateCredential()),
        generateVoterCommitment(generateCredential()),
        generateVoterCommitment(generateCredential())
      ]
      tree = buildMerkleTree(voterCommitments)
    })
    
    it('should export tree data', () => {
      const exported = exportTree(tree)
      
      expect(exported).to.have.property('leaves')
      expect(exported).to.have.property('root')
      expect(exported).to.have.property('depth')
      expect(exported).to.have.property('leafCount')
      expect(exported.leaves).to.have.lengthOf(voterCommitments.length)
    })
    
    it('should import tree from data', () => {
      const exported = exportTree(tree)
      const imported = importTree(exported.leaves)
      
      expect(getMerkleRoot(imported)).to.equal(exported.root)
    })
    
    it('should preserve tree structure after export/import', () => {
      const originalRoot = getMerkleRoot(tree)
      const exported = exportTree(tree)
      const imported = importTree(exported.leaves)
      
      // Test proofs still work after import
      const commitment = voterCommitments[0]
      const proof = generateMerkleProof(imported, commitment)
      
      expect(proof.root).to.equal(originalRoot)
      expect(proof.verified).to.be.true
    })
  })
  
  describe('Voter Tree', () => {
    it('should build complete voter tree with proofs', () => {
      const voters: VoterLeaf[] = [
        { index: 0, voterId: generateCredential(), commitment: generateVoterCommitment(generateCredential()) },
        { index: 1, voterId: generateCredential(), commitment: generateVoterCommitment(generateCredential()) },
        { index: 2, voterId: generateCredential(), commitment: generateVoterCommitment(generateCredential()) },
        { index: 3, voterId: generateCredential(), commitment: generateVoterCommitment(generateCredential()) }
      ]
      
      const result = buildVoterTree(voters)
      
      expect(result).to.have.property('tree')
      expect(result).to.have.property('root')
      expect(result).to.have.property('proofs')
      expect(result.proofs.size).to.equal(voters.length)
    })
    
    it('should generate valid proofs for all voters', () => {
      // Generate voters with commitment derived from voterId
      const voterIds = [generateCredential(), generateCredential(), generateCredential()]
      const voters: VoterLeaf[] = voterIds.map((voterId, index) => ({
        index,
        voterId,
        commitment: generateVoterCommitment(voterId)
      }))
      
      const result = buildVoterTree(voters)
      
      voters.forEach(voter => {
        const proof = result.proofs.get(voter.voterId)
        expect(proof).to.not.be.undefined
        expect(proof!.verified).to.be.true
        expect(proof!.root).to.equal(result.root)
      })
    })
  })
  
  describe('Sparse Merkle Tree', () => {
    it('should create sparse Merkle tree', () => {
      const tree = new SparseMerkleTree(4)
      expect(tree.getRoot()).to.be.a('string')
    })
    
    it('should insert and retrieve leaves', () => {
      const tree = new SparseMerkleTree(4)
      const value = generateCredential()
      
      tree.insert(5, value)
      
      expect(tree.get(5)).to.equal(value)
      expect(tree.get(3)).to.be.null
    })
    
    it('should generate valid sparse proofs', () => {
      const tree = new SparseMerkleTree(4)
      const value = generateCredential()
      
      tree.insert(7, value)
      
      const proof = tree.generateProof(7)
      
      expect(proof.leaf).to.equal(value)
      expect(proof.proof).to.have.lengthOf(4) // depth
      expect(proof.verified).to.be.true
    })
    
    it('should update root when leaves change', () => {
      const tree = new SparseMerkleTree(4)
      const root1 = tree.getRoot()
      
      tree.insert(3, generateCredential())
      const root2 = tree.getRoot()
      
      expect(root1).to.not.equal(root2)
    })
    
    it('should export and import sparse tree', () => {
      const tree = new SparseMerkleTree(4)
      tree.insert(1, generateCredential())
      tree.insert(5, generateCredential())
      tree.insert(10, generateCredential())
      
      const exported = tree.export()
      const imported = SparseMerkleTree.import(exported)
      
      expect(imported.getRoot()).to.equal(tree.getRoot())
      expect(imported.get(1)).to.equal(tree.get(1))
      expect(imported.get(5)).to.equal(tree.get(5))
      expect(imported.get(10)).to.equal(tree.get(10))
    })
    
    it('should handle large sparse trees efficiently', () => {
      const tree = new SparseMerkleTree(20) // 2^20 = 1M leaves
      
      // Insert only a few leaves
      tree.insert(1000, generateCredential())
      tree.insert(50000, generateCredential())
      tree.insert(999999, generateCredential())
      
      const root = tree.getRoot()
      expect(root).to.be.a('string')
      expect(root).to.have.lengthOf(64)
    })
    
    it('should throw error for out of bounds index', () => {
      const tree = new SparseMerkleTree(4)
      
      expect(() => tree.insert(16, generateCredential())).to.throw()
      expect(() => tree.insert(-1, generateCredential())).to.throw()
    })
  })
  
  describe('Edge Cases', () => {
    it('should handle single leaf tree', () => {
      const commitment = generateVoterCommitment(generateCredential())
      const tree = buildMerkleTree([commitment])
      
      const root = getMerkleRoot(tree)
      expect(root).to.be.a('string')
      
      const proof = generateMerkleProof(tree, commitment)
      expect(proof.verified).to.be.true
    })
    
    it('should handle two leaf tree', () => {
      const commitments = [
        generateVoterCommitment(generateCredential()),
        generateVoterCommitment(generateCredential())
      ]
      const tree = buildMerkleTree(commitments)
      
      commitments.forEach(c => {
        const proof = generateMerkleProof(tree, c)
        expect(proof.verified).to.be.true
      })
    })
    
    it('should handle odd number of leaves', () => {
      const commitments = [
        generateVoterCommitment(generateCredential()),
        generateVoterCommitment(generateCredential()),
        generateVoterCommitment(generateCredential())
      ]
      const tree = buildMerkleTree(commitments)
      
      const root = getMerkleRoot(tree)
      expect(root).to.be.a('string')
    })
    
    it('should handle large number of leaves', () => {
      const count = 1000
      const commitments = Array(count).fill(0).map(() => 
        generateVoterCommitment(generateCredential())
      )
      
      const tree = buildMerkleTree(commitments)
      const root = getMerkleRoot(tree)
      
      expect(root).to.be.a('string')
      
      // Verify random proofs
      const randomIndex = Math.floor(Math.random() * count)
      const proof = generateMerkleProof(tree, commitments[randomIndex])
      expect(proof.verified).to.be.true
    })
  })
})
