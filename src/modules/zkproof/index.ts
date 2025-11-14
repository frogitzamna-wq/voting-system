/**
 * Zero-Knowledge Proof Module
 * 
 * Handles ZK-SNARK proof generation and verification:
 * - Generate proofs of voter eligibility
 * - Verify proofs on-chain
 * - Manage proving/verification keys
 * - Integration with ZoKrates
 */

import { initialize } from 'zokrates-js'
import { sha256 } from '../crypto/index.js'
import { MerkleProof } from '../merkle/index.js'
import * as fs from 'fs/promises'
import * as path from 'path'

export interface ZKProofInputs {
  // Private inputs
  voterId: string
  voteChoice: number
  voteRandomness: string
  merklePath: string[]
  merkleIndices: bigint
  
  // Public inputs
  merkleRoot: string
  nullifierHash: string
  voteCommitment: string
  ballotId: string
  candidateCount: number
}

export interface ZKProof {
  proof: {
    a: string[]
    b: string[][]
    c: string[]
  }
  inputs: string[]
}

export interface VerificationKey {
  alpha: string[]
  beta: string[][]
  gamma: string[][]
  delta: string[][]
  gamma_abc: string[][]
}

let zokratesProvider: any = null

/**
 * Initialize ZoKrates provider
 */
async function getZokratesProvider() {
  if (!zokratesProvider) {
    zokratesProvider = await initialize()
  }
  return zokratesProvider
}

/**
 * Compile ZK circuit
 */
export async function compileCircuit(
  circuitPath: string
): Promise<{
  program: Uint8Array
  abi: any
}> {
  const zokrates = await getZokratesProvider()
  const source = await fs.readFile(circuitPath, 'utf-8')
  
  const artifacts = zokrates.compile(source)
  
  return {
    program: artifacts.program,
    abi: artifacts.abi
  }
}

/**
 * Setup phase (generate proving and verification keys)
 * This should be done once during deployment using a trusted setup ceremony
 */
export async function setup(
  program: Uint8Array
): Promise<{
  provingKey: Uint8Array
  verificationKey: VerificationKey
}> {
  const zokrates = await getZokratesProvider()
  
  const keypair = zokrates.setup(program)
  
  return {
    provingKey: keypair.pk,
    verificationKey: keypair.vk as VerificationKey
  }
}

/**
 * Generate ZK proof
 */
export async function generateProof(
  program: Uint8Array,
  provingKey: Uint8Array,
  inputs: ZKProofInputs
): Promise<ZKProof> {
  const zokrates = await getZokratesProvider()
  
  // Prepare witness inputs
  const witnessInputs = [
    // Private inputs
    inputs.voterId,
    inputs.voteChoice.toString(),
    inputs.voteRandomness,
    ...inputs.merklePath,
    inputs.merkleIndices.toString(),
    
    // Public inputs
    inputs.merkleRoot,
    inputs.nullifierHash,
    inputs.voteCommitment,
    inputs.ballotId,
    inputs.candidateCount.toString()
  ]
  
  // Compute witness
  const witness = zokrates.computeWitness(program, witnessInputs)
  
  // Generate proof
  const proof = zokrates.generateProof(program, witness, provingKey)
  
  return proof
}

/**
 * Verify ZK proof
 */
export async function verifyProof(
  verificationKey: VerificationKey,
  proof: ZKProof
): Promise<boolean> {
  const zokrates = await getZokratesProvider()
  
  try {
    const isValid = zokrates.verify(verificationKey, proof)
    return isValid
  } catch (error) {
    console.error('Proof verification failed:', error)
    return false
  }
}

/**
 * Export verification key for on-chain use
 */
export async function exportVerificationKey(
  verificationKey: VerificationKey
): Promise<string> {
  const zokrates = await getZokratesProvider()
  
  // Export as Solidity verifier (can be adapted for sCrypt)
  const solidityCode = zokrates.exportSolidityVerifier(verificationKey)
  
  return solidityCode
}

/**
 * Serialize proof for blockchain
 */
export function serializeProof(proof: ZKProof): string {
  return JSON.stringify(proof)
}

/**
 * Deserialize proof from blockchain
 */
export function deserializeProof(proofString: string): ZKProof {
  return JSON.parse(proofString)
}

/**
 * Prepare public inputs for verification
 */
export function preparePublicInputs(inputs: ZKProofInputs): string[] {
  return [
    inputs.merkleRoot,
    inputs.nullifierHash,
    inputs.voteCommitment,
    inputs.ballotId,
    inputs.candidateCount.toString()
  ]
}

/**
 * Generate vote proof (high-level wrapper)
 */
export async function generateVoteProof(
  voterId: string,
  voteChoice: number,
  ballotId: string,
  candidateCount: number,
  merkleProof: MerkleProof,
  voteRandomness: string,
  provingKey: Uint8Array,
  program: Uint8Array
): Promise<{
  proof: ZKProof
  nullifierHash: string
  voteCommitment: string
}> {
  // Compute nullifier
  const nullifierData = Buffer.concat([
    Buffer.from(voterId, 'hex'),
    Buffer.from(ballotId, 'hex')
  ])
  const nullifierHash = sha256(nullifierData).toString('hex')
  
  // Compute vote commitment
  const commitmentData = Buffer.concat([
    Buffer.from(voteChoice.toString()),
    Buffer.from(voteRandomness, 'hex')
  ])
  const voteCommitment = sha256(commitmentData).toString('hex')
  
  // Prepare inputs
  const inputs: ZKProofInputs = {
    voterId,
    voteChoice,
    voteRandomness,
    merklePath: merkleProof.proof,
    merkleIndices: merkleProof.indices,
    merkleRoot: merkleProof.root,
    nullifierHash,
    voteCommitment,
    ballotId,
    candidateCount
  }
  
  // Generate proof
  const proof = await generateProof(program, provingKey, inputs)
  
  return {
    proof,
    nullifierHash,
    voteCommitment
  }
}

/**
 * Verify vote proof (high-level wrapper)
 */
export async function verifyVoteProof(
  proof: ZKProof,
  verificationKey: VerificationKey,
  expectedPublicInputs: {
    merkleRoot: string
    nullifierHash: string
    voteCommitment: string
    ballotId: string
    candidateCount: number
  }
): Promise<boolean> {
  // Verify proof cryptographically
  const isValid = await verifyProof(verificationKey, proof)
  
  if (!isValid) {
    return false
  }
  
  // Verify public inputs match
  const expectedInputs = [
    expectedPublicInputs.merkleRoot,
    expectedPublicInputs.nullifierHash,
    expectedPublicInputs.voteCommitment,
    expectedPublicInputs.ballotId,
    expectedPublicInputs.candidateCount.toString()
  ]
  
  const inputsMatch = JSON.stringify(proof.inputs) === JSON.stringify(expectedInputs)
  
  return inputsMatch
}

/**
 * Load proving key from file
 */
export async function loadProvingKey(filePath: string): Promise<Uint8Array> {
  const buffer = await fs.readFile(filePath)
  return new Uint8Array(buffer)
}

/**
 * Save proving key to file
 */
export async function saveProvingKey(
  provingKey: Uint8Array,
  filePath: string
): Promise<void> {
  await fs.writeFile(filePath, Buffer.from(provingKey))
}

/**
 * Load verification key from file
 */
export async function loadVerificationKey(
  filePath: string
): Promise<VerificationKey> {
  const content = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(content)
}

/**
 * Save verification key to file
 */
export async function saveVerificationKey(
  verificationKey: VerificationKey,
  filePath: string
): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(verificationKey, null, 2))
}

/**
 * Compute proof hash (for caching)
 */
export function computeProofHash(proof: ZKProof): string {
  const proofString = serializeProof(proof)
  return sha256(Buffer.from(proofString)).toString('hex')
}

export default {
  compileCircuit,
  setup,
  generateProof,
  verifyProof,
  exportVerificationKey,
  serializeProof,
  deserializeProof,
  preparePublicInputs,
  generateVoteProof,
  verifyVoteProof,
  loadProvingKey,
  saveProvingKey,
  loadVerificationKey,
  saveVerificationKey,
  computeProofHash
}
