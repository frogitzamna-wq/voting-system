/**
 * Crypto Module
 * 
 * Handles cryptographic operations for the voting system:
 * - HD wallet key derivation
 * - Hashing and commitments
 * - Encryption/decryption
 * - Signature generation and verification
 */

import * as bip39 from 'bip39'
import * as bip32 from 'bip32'
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto'
import { PrivateKey, Hash, PublicKey, AES } from '@bsv/sdk'

/**
 * Generate mnemonic seed phrase
 */
export function generateMnemonic(strength: number = 256): string {
  return bip39.generateMnemonic(strength)
}

/**
 * Validate mnemonic
 */
export function validateMnemonic(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic)
}

/**
 * Derive HD key from mnemonic
 */
export function deriveKeyFromMnemonic(
  mnemonic: string,
  path: string = "m/44'/0'/0'/0/0"
): { privateKey: string; publicKey: string; address: string } {
  const seed = bip39.mnemonicToSeedSync(mnemonic)
  const root = bip32.fromSeed(seed)
  const child = root.derivePath(path)

  if (!child.privateKey) {
    throw new Error('Failed to derive private key')
  }

  const privKey = PrivateKey.fromString(child.privateKey.toString('hex'), 'hex')
  const pubKey = privKey.toPublicKey()

  return {
    privateKey: privKey.toString(),
    publicKey: pubKey.toString(),
    address: pubKey.toAddress() || ''
  }
}

/**
 * Generate random credential
 */
export function generateCredential(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Hash data with SHA-256
 */
export function sha256(data: string | Buffer): Buffer {
  return createHash('sha256').update(data).digest()
}

/**
 * Double SHA-256 (BSV standard)
 */
export function hash256(data: string | Buffer): Buffer {
  return sha256(sha256(data))
}

/**
 * Create Pedersen commitment
 * commitment = hash(value || randomness)
 */
export function createCommitment(value: string, randomness: string): string {
  const data = Buffer.concat([
    Buffer.from(value, 'utf8'),
    Buffer.from(randomness, 'hex')
  ])
  return sha256(data).toString('hex')
}

/**
 * Generate nullifier
 * nullifier = hash(voterId || ballotId)
 */
export function generateNullifier(voterId: string, ballotId: string): string {
  const data = Buffer.concat([
    Buffer.from(voterId, 'hex'),
    Buffer.from(ballotId, 'hex')
  ])
  return sha256(data).toString('hex')
}

/**
 * Generate voter commitment for Merkle tree
 * commitment = hash(voterId)
 */
export function generateVoterCommitment(voterId: string): string {
  return sha256(Buffer.from(voterId, 'hex')).toString('hex')
}

/**
 * Encrypt data with AES-256-CBC
 */
export function encrypt(data: string, key: string): { 
  ciphertext: string; 
  iv: string 
} {
  const keyBuffer = Buffer.from(key, 'hex')
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', keyBuffer, iv)
  
  let encrypted = cipher.update(data, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  return {
    ciphertext: encrypted,
    iv: iv.toString('hex')
  }
}

/**
 * Decrypt data with AES-256-CBC
 */
export function decrypt(
  ciphertext: string, 
  key: string, 
  iv: string
): string {
  const keyBuffer = Buffer.from(key, 'hex')
  const ivBuffer = Buffer.from(iv, 'hex')
  const decipher = createDecipheriv('aes-256-cbc', keyBuffer, ivBuffer)
  
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

/**
 * Sign message with private key
 */
export function signMessage(message: string, privateKey: string): string {
  const privKey = PrivateKey.fromString(privateKey, 'hex')
  const messageHash = Hash.sha256(Buffer.from(message, 'utf8'))
  const signature = privKey.sign(messageHash)
  return signature.toString()
}

/**
 * Verify signature
 */
export function verifySignature(
  message: string,
  signature: string,
  publicKey: string
): boolean {
  try {
    const pubKey = PublicKey.fromString(publicKey)
    const messageHash = Hash.sha256(Buffer.from(message, 'utf8'))
    return pubKey.verify(messageHash, signature)
  } catch {
    return false
  }
}

/**
 * Generate random salt
 */
export function generateSalt(length: number = 32): string {
  return randomBytes(length).toString('hex')
}

/**
 * Hash password with salt (for admin credentials)
 */
export function hashPassword(password: string, salt?: string): {
  hash: string;
  salt: string;
} {
  const saltToUse = salt || generateSalt()
  const hash = createHash('sha256')
    .update(password + saltToUse)
    .digest('hex')
  
  return { hash, salt: saltToUse }
}

/**
 * Verify password
 */
export function verifyPassword(
  password: string,
  hash: string,
  salt: string
): boolean {
  const computed = hashPassword(password, salt)
  return computed.hash === hash
}

/**
 * Generate random randomness for commitments
 */
export function generateRandomness(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Compute merkle leaf hash
 */
export function computeLeafHash(data: string): string {
  return sha256(Buffer.from(data, 'hex')).toString('hex')
}

/**
 * Compute merkle parent hash
 */
export function computeParentHash(left: string, right: string): string {
  const data = Buffer.concat([
    Buffer.from(left, 'hex'),
    Buffer.from(right, 'hex')
  ])
  return sha256(data).toString('hex')
}

export default {
  generateMnemonic,
  validateMnemonic,
  deriveKeyFromMnemonic,
  generateCredential,
  sha256,
  hash256,
  createCommitment,
  generateNullifier,
  generateVoterCommitment,
  encrypt,
  decrypt,
  signMessage,
  verifySignature,
  generateSalt,
  hashPassword,
  verifyPassword,
  generateRandomness,
  computeLeafHash,
  computeParentHash
}
