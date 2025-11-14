/**
 * Unit tests for Crypto module
 */

import { expect } from 'chai'
import {
  generateMnemonic,
  validateMnemonic,
  generateCredential,
  sha256,
  createCommitment,
  generateNullifier,
  generateVoterCommitment,
  encrypt,
  decrypt,
  generateRandomness
} from '../../src/modules/crypto/index.js'

describe('Crypto Module', () => {
  describe('Mnemonic generation', () => {
    it('should generate valid 24-word mnemonic', () => {
      const mnemonic = generateMnemonic(256)
      expect(mnemonic).to.be.a('string')
      expect(mnemonic.split(' ')).to.have.lengthOf(24)
      expect(validateMnemonic(mnemonic)).to.be.true
    })

    it('should generate valid 12-word mnemonic', () => {
      const mnemonic = generateMnemonic(128)
      expect(mnemonic).to.be.a('string')
      expect(mnemonic.split(' ')).to.have.lengthOf(12)
      expect(validateMnemonic(mnemonic)).to.be.true
    })

    it('should reject invalid mnemonic', () => {
      const invalid = 'invalid mnemonic phrase test words here'
      expect(validateMnemonic(invalid)).to.be.false
    })
  })

  describe('Credential generation', () => {
    it('should generate random credential', () => {
      const credential = generateCredential()
      expect(credential).to.be.a('string')
      expect(credential).to.have.lengthOf(64) // 32 bytes hex
    })

    it('should generate unique credentials', () => {
      const cred1 = generateCredential()
      const cred2 = generateCredential()
      expect(cred1).to.not.equal(cred2)
    })
  })

  describe('Hashing', () => {
    it('should hash data with SHA-256', () => {
      const data = 'test data'
      const hash = sha256(data)
      expect(hash).to.be.instanceOf(Buffer)
      expect(hash).to.have.lengthOf(32)
    })

    it('should produce consistent hashes', () => {
      const data = 'consistent data'
      const hash1 = sha256(data)
      const hash2 = sha256(data)
      expect(hash1.toString('hex')).to.equal(hash2.toString('hex'))
    })

    it('should produce different hashes for different data', () => {
      const hash1 = sha256('data1')
      const hash2 = sha256('data2')
      expect(hash1.toString('hex')).to.not.equal(hash2.toString('hex'))
    })
  })

  describe('Commitments', () => {
    it('should create vote commitment', () => {
      const value = 'candidate_0'
      const randomness = generateRandomness()
      const commitment = createCommitment(value, randomness)
      
      expect(commitment).to.be.a('string')
      expect(commitment).to.have.lengthOf(64)
    })

    it('should create consistent commitments', () => {
      const value = 'candidate_1'
      const randomness = generateRandomness()
      
      const commitment1 = createCommitment(value, randomness)
      const commitment2 = createCommitment(value, randomness)
      
      expect(commitment1).to.equal(commitment2)
    })

    it('should create different commitments with different randomness', () => {
      const value = 'candidate_2'
      const randomness1 = generateRandomness()
      const randomness2 = generateRandomness()
      
      const commitment1 = createCommitment(value, randomness1)
      const commitment2 = createCommitment(value, randomness2)
      
      expect(commitment1).to.not.equal(commitment2)
    })
  })

  describe('Nullifiers', () => {
    it('should generate nullifier from voter ID and ballot ID', () => {
      const voterId = generateCredential()
      const ballotId = generateCredential()
      const nullifier = generateNullifier(voterId, ballotId)
      
      expect(nullifier).to.be.a('string')
      expect(nullifier).to.have.lengthOf(64)
    })

    it('should generate consistent nullifiers', () => {
      const voterId = generateCredential()
      const ballotId = generateCredential()
      
      const nullifier1 = generateNullifier(voterId, ballotId)
      const nullifier2 = generateNullifier(voterId, ballotId)
      
      expect(nullifier1).to.equal(nullifier2)
    })

    it('should generate different nullifiers for different voters', () => {
      const voterId1 = generateCredential()
      const voterId2 = generateCredential()
      const ballotId = generateCredential()
      
      const nullifier1 = generateNullifier(voterId1, ballotId)
      const nullifier2 = generateNullifier(voterId2, ballotId)
      
      expect(nullifier1).to.not.equal(nullifier2)
    })
  })

  describe('Voter commitments', () => {
    it('should generate voter commitment', () => {
      const voterId = generateCredential()
      const commitment = generateVoterCommitment(voterId)
      
      expect(commitment).to.be.a('string')
      expect(commitment).to.have.lengthOf(64)
    })

    it('should generate consistent voter commitments', () => {
      const voterId = generateCredential()
      
      const commitment1 = generateVoterCommitment(voterId)
      const commitment2 = generateVoterCommitment(voterId)
      
      expect(commitment1).to.equal(commitment2)
    })
  })

  describe('Encryption/Decryption', () => {
    it('should encrypt and decrypt data', () => {
      const data = 'secret message'
      const key = generateRandomness()
      
      const { ciphertext, iv } = encrypt(data, key)
      const decrypted = decrypt(ciphertext, key, iv)
      
      expect(decrypted).to.equal(data)
    })

    it('should produce different ciphertexts with different IVs', () => {
      const data = 'secret message'
      const key = generateRandomness()
      
      const result1 = encrypt(data, key)
      const result2 = encrypt(data, key)
      
      expect(result1.ciphertext).to.not.equal(result2.ciphertext)
      expect(result1.iv).to.not.equal(result2.iv)
    })

    it('should fail to decrypt with wrong key', () => {
      const data = 'secret message'
      const key1 = generateRandomness()
      const key2 = generateRandomness()
      
      const { ciphertext, iv } = encrypt(data, key1)
      
      expect(() => decrypt(ciphertext, key2, iv)).to.throw()
    })
  })

  describe('Randomness generation', () => {
    it('should generate random values', () => {
      const random1 = generateRandomness()
      const random2 = generateRandomness()
      
      expect(random1).to.be.a('string')
      expect(random1).to.have.lengthOf(64)
      expect(random1).to.not.equal(random2)
    })
  })
})
