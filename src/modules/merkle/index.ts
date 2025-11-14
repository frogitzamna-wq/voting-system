/**
 * Merkle Tree Module
 * 
 * Implements Merkle tree for eligible voter registry:
 * - Build tree from voter commitments
 * - Generate Merkle proofs
 * - Verify Merkle proofs
 * - Support for sparse Merkle trees
 */

import { MerkleTree } from 'merkletreejs'
import { sha256, computeLeafHash, computeParentHash } from '../crypto/index.js'

export interface MerkleProof {
  leaf: string
  root: string
  proof: string[]
  indices: bigint
  verified: boolean
}

export interface VoterLeaf {
  index: number
  commitment: string
  voterId: string
}

/**
 * Build Merkle tree from voter commitments
 */
export function buildMerkleTree(voterCommitments: string[]): MerkleTree {
  // Convert commitments to Buffer leaves
  const leaves = voterCommitments.map(c => Buffer.from(c, 'hex'))
  
  // Build tree with SHA-256
  const tree = new MerkleTree(leaves, sha256, {
    sortPairs: true,
    duplicateOdd: true
  })
  
  return tree
}

/**
 * Get Merkle root
 */
export function getMerkleRoot(tree: MerkleTree): string {
  return tree.getRoot().toString('hex')
}

/**
 * Generate Merkle proof for specific voter
 */
export function generateMerkleProof(
  tree: MerkleTree,
  voterCommitment: string
): MerkleProof {
  const leaf = Buffer.from(voterCommitment, 'hex')
  const proof = tree.getProof(leaf)
  const root = tree.getRoot()
  
  // Convert proof to array of hex strings
  const proofHashes = proof.map(p => p.data.toString('hex'))
  
  // Calculate indices (bit pattern for left/right)
  let indices = 0n
  proof.forEach((p, i) => {
    if (p.position === 'right') {
      indices |= (1n << BigInt(i))
    }
  })
  
  // Verify the proof
  const verified = tree.verify(proof, leaf, root)
  
  return {
    leaf: voterCommitment,
    root: root.toString('hex'),
    proof: proofHashes,
    indices,
    verified
  }
}

/**
 * Verify Merkle proof
 */
export function verifyMerkleProof(
  leaf: string,
  proof: string[],
  indices: bigint,
  root: string
): boolean {
  let computedHash = Buffer.from(leaf, 'hex')
  
  for (let i = 0; i < proof.length; i++) {
    const proofElement = Buffer.from(proof[i], 'hex')
    const isRight = (indices >> BigInt(i)) & 1n
    
    if (isRight === 1n) {
      // Proof element is on the right
      computedHash = sha256(Buffer.concat([computedHash, proofElement]))
    } else {
      // Proof element is on the left
      computedHash = sha256(Buffer.concat([proofElement, computedHash]))
    }
  }
  
  return computedHash.toString('hex') === root
}

/**
 * Get leaf index in tree
 */
export function getLeafIndex(
  tree: MerkleTree,
  voterCommitment: string
): number {
  const leaves = tree.getLeaves()
  const leaf = Buffer.from(voterCommitment, 'hex')
  
  return leaves.findIndex(l => l.equals(leaf))
}

/**
 * Get all leaves
 */
export function getLeaves(tree: MerkleTree): string[] {
  return tree.getLeaves().map(l => l.toString('hex'))
}

/**
 * Export tree data for storage
 */
export function exportTree(tree: MerkleTree): {
  leaves: string[]
  root: string
  depth: number
  leafCount: number
} {
  const leaves = getLeaves(tree)
  const root = getMerkleRoot(tree)
  
  return {
    leaves,
    root,
    depth: tree.getDepth(),
    leafCount: tree.getLeafCount()
  }
}

/**
 * Import tree from stored data
 */
export function importTree(leaves: string[]): MerkleTree {
  return buildMerkleTree(leaves)
}

/**
 * Build sparse Merkle tree (for large voter sets)
 * Only stores non-zero leaves
 */
export class SparseMerkleTree {
  private leaves: Map<number, string>
  private depth: number
  private root: string

  constructor(depth: number = 32) {
    this.leaves = new Map()
    this.depth = depth
    this.root = this.computeRoot()
  }

  /**
   * Insert leaf at specific index
   */
  insert(index: number, value: string): void {
    if (index < 0 || index >= Math.pow(2, this.depth)) {
      throw new Error(`Index out of bounds: ${index}`)
    }
    
    this.leaves.set(index, value)
    this.root = this.computeRoot()
  }

  /**
   * Get leaf at index
   */
  get(index: number): string | null {
    return this.leaves.get(index) || null
  }

  /**
   * Generate Merkle proof for leaf at index
   */
  generateProof(index: number): MerkleProof {
    const proof: string[] = []
    let currentIndex = index
    
    for (let level = 0; level < this.depth; level++) {
      const siblingIndex = currentIndex ^ 1
      const sibling = this.getNodeHash(level, siblingIndex)
      proof.push(sibling)
      currentIndex = Math.floor(currentIndex / 2)
    }
    
    const leaf = this.leaves.get(index) || this.getEmptyLeaf()
    const verified = verifyMerkleProof(
      leaf,
      proof,
      BigInt(index),
      this.root
    )
    
    return {
      leaf,
      root: this.root,
      proof,
      indices: BigInt(index),
      verified
    }
  }

  /**
   * Get root hash
   */
  getRoot(): string {
    return this.root
  }

  /**
   * Compute root from leaves
   */
  private computeRoot(): string {
    return this.getNodeHash(this.depth, 0)
  }

  /**
   * Get hash at specific node
   */
  private getNodeHash(level: number, index: number): string {
    if (level === 0) {
      return this.leaves.get(index) || this.getEmptyLeaf()
    }
    
    const leftChild = this.getNodeHash(level - 1, index * 2)
    const rightChild = this.getNodeHash(level - 1, index * 2 + 1)
    
    return computeParentHash(leftChild, rightChild)
  }

  /**
   * Get empty leaf hash (zero value)
   */
  private getEmptyLeaf(): string {
    return '0'.repeat(64)
  }

  /**
   * Export sparse tree data
   */
  export(): {
    leaves: Array<[number, string]>
    root: string
    depth: number
  } {
    return {
      leaves: Array.from(this.leaves.entries()),
      root: this.root,
      depth: this.depth
    }
  }

  /**
   * Import sparse tree data
   */
  static import(data: {
    leaves: Array<[number, string]>
    depth: number
  }): SparseMerkleTree {
    const tree = new SparseMerkleTree(data.depth)
    data.leaves.forEach(([index, value]) => {
      tree.insert(index, value)
    })
    return tree
  }
}

/**
 * Build tree from voter list
 */
export function buildVoterTree(voters: VoterLeaf[]): {
  tree: MerkleTree
  root: string
  proofs: Map<string, MerkleProof>
} {
  // Extract commitments in index order
  const sortedVoters = voters.sort((a, b) => a.index - b.index)
  const commitments = sortedVoters.map(v => v.commitment)
  
  // Build tree
  const tree = buildMerkleTree(commitments)
  const root = getMerkleRoot(tree)
  
  // Generate proofs for all voters
  const proofs = new Map<string, MerkleProof>()
  voters.forEach(voter => {
    const proof = generateMerkleProof(tree, voter.commitment)
    proofs.set(voter.voterId, proof)
  })
  
  return { tree, root, proofs }
}

export default {
  buildMerkleTree,
  getMerkleRoot,
  generateMerkleProof,
  verifyMerkleProof,
  getLeafIndex,
  getLeaves,
  exportTree,
  importTree,
  buildVoterTree,
  SparseMerkleTree
}
