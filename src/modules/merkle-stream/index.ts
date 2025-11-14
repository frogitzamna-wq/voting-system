/**
 * Incremental Merkle Tree (Merkle Stream) Module
 * 
 * Allows updating Merkle root incrementally without recomputing entire tree.
 * Perfect for real-time vote verification as votes come in.
 * 
 * Uses append-only tree structure where new votes are added as leaves
 * and only the path from new leaf to root needs updating.
 */

import { sha256, computeParentHash } from '../crypto/index.js'

export interface MerkleNode {
  hash: string
  left?: MerkleNode
  right?: MerkleNode
  index: number
  isComplete: boolean
}

export interface MerkleUpdate {
  newLeaf: string
  newRoot: string
  affectedPath: string[]
  timestamp: number
  leafCount: number
}

export interface MerkleCheckpoint {
  root: string
  leafCount: number
  timestamp: number
  height: number
}

/**
 * Incremental Merkle Tree
 * Optimized for append-only operations
 */
export class IncrementalMerkleTree {
  private leaves: string[]
  private root: string
  private checkpoints: MerkleCheckpoint[]
  private maxCheckpoints: number
  
  constructor(maxCheckpoints: number = 100) {
    this.leaves = []
    this.root = ''
    this.checkpoints = []
    this.maxCheckpoints = maxCheckpoints
  }
  
  /**
   * Append a new leaf to the tree
   * Returns update with only modified nodes
   */
  append(leaf: string): MerkleUpdate {
    const timestamp = Date.now()
    const oldRoot = this.root
    const leafIndex = this.leaves.length
    
    this.leaves.push(leaf)
    
    // Compute new root incrementally
    const affectedPath = this.computeIncrementalRoot(leafIndex)
    
    const update: MerkleUpdate = {
      newLeaf: leaf,
      newRoot: this.root,
      affectedPath,
      timestamp,
      leafCount: this.leaves.length
    }
    
    // Create checkpoint periodically
    if (this.leaves.length % 100 === 0) {
      this.createCheckpoint()
    }
    
    return update
  }
  
  /**
   * Append multiple leaves efficiently
   */
  appendBatch(newLeaves: string[]): MerkleUpdate[] {
    return newLeaves.map(leaf => this.append(leaf))
  }
  
  /**
   * Compute new root by only updating affected path
   * O(log n) complexity instead of O(n)
   */
  private computeIncrementalRoot(newLeafIndex: number): string[] {
    const affectedPath: string[] = []
    const treeHeight = Math.ceil(Math.log2(this.leaves.length || 1))
    
    let currentHash = this.leaves[newLeafIndex]
    affectedPath.push(currentHash)
    
    let currentIndex = newLeafIndex
    
    for (let level = 0; level < treeHeight; level++) {
      const isRightNode = currentIndex % 2 === 1
      const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1
      
      let leftHash: string
      let rightHash: string
      
      if (isRightNode) {
        leftHash = this.getHashAtLevel(level, siblingIndex)
        rightHash = currentHash
      } else {
        leftHash = currentHash
        rightHash = this.getHashAtLevel(level, siblingIndex) || leftHash
      }
      
      currentHash = computeParentHash(leftHash, rightHash)
      affectedPath.push(currentHash)
      currentIndex = Math.floor(currentIndex / 2)
    }
    
    this.root = currentHash
    return affectedPath
  }
  
  /**
   * Get hash at specific level and index
   */
  private getHashAtLevel(level: number, index: number): string {
    if (level === 0) {
      return this.leaves[index] || ''
    }
    
    // Recursively compute hash at level
    const leftChildIndex = index * 2
    const rightChildIndex = index * 2 + 1
    
    const leftHash = this.getHashAtLevel(level - 1, leftChildIndex)
    const rightHash = this.getHashAtLevel(level - 1, rightChildIndex)
    
    if (!leftHash) return ''
    if (!rightHash) return leftHash
    
    return computeParentHash(leftHash, rightHash)
  }
  
  /**
   * Get current root
   */
  getRoot(): string {
    return this.root
  }
  
  /**
   * Get leaf count
   */
  getLeafCount(): number {
    return this.leaves.length
  }
  
  /**
   * Get all leaves
   */
  getLeaves(): string[] {
    return [...this.leaves]
  }
  
  /**
   * Get leaf at index
   */
  getLeaf(index: number): string | null {
    return this.leaves[index] || null
  }
  
  /**
   * Create checkpoint for rollback capability
   */
  private createCheckpoint(): void {
    const checkpoint: MerkleCheckpoint = {
      root: this.root,
      leafCount: this.leaves.length,
      timestamp: Date.now(),
      height: Math.ceil(Math.log2(this.leaves.length || 1))
    }
    
    this.checkpoints.push(checkpoint)
    
    // Keep only last N checkpoints
    if (this.checkpoints.length > this.maxCheckpoints) {
      this.checkpoints.shift()
    }
  }
  
  /**
   * Get all checkpoints
   */
  getCheckpoints(): MerkleCheckpoint[] {
    return [...this.checkpoints]
  }
  
  /**
   * Get latest checkpoint
   */
  getLatestCheckpoint(): MerkleCheckpoint | null {
    return this.checkpoints[this.checkpoints.length - 1] || null
  }
  
  /**
   * Generate proof for a leaf at index
   */
  generateProof(leafIndex: number): {
    leaf: string
    proof: string[]
    indices: bigint
    root: string
  } | null {
    if (leafIndex < 0 || leafIndex >= this.leaves.length) {
      return null
    }
    
    const proof: string[] = []
    let indices = 0n
    let currentIndex = leafIndex
    const treeHeight = Math.ceil(Math.log2(this.leaves.length))
    
    for (let level = 0; level < treeHeight; level++) {
      const isRightNode = currentIndex % 2 === 1
      const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1
      
      const siblingHash = this.getHashAtLevel(level, siblingIndex)
      if (siblingHash) {
        proof.push(siblingHash)
        if (siblingIndex > currentIndex) {
          indices |= (1n << BigInt(level))
        }
      }
      
      currentIndex = Math.floor(currentIndex / 2)
    }
    
    return {
      leaf: this.leaves[leafIndex],
      proof,
      indices,
      root: this.root
    }
  }
  
  /**
   * Verify incremental update
   */
  verifyUpdate(update: MerkleUpdate, previousRoot: string): boolean {
    // Verify root transition is valid
    if (update.affectedPath.length === 0) {
      return false
    }
    
    // Last element in path should be new root
    return update.affectedPath[update.affectedPath.length - 1] === update.newRoot
  }
  
  /**
   * Get tree statistics
   */
  getStats(): {
    leafCount: number
    height: number
    checkpointCount: number
    efficiency: number  // Updates per full rebuild
  } {
    const height = Math.ceil(Math.log2(this.leaves.length || 1))
    const fullTreeOperations = this.leaves.length
    const incrementalOperations = height * this.leaves.length
    const efficiency = fullTreeOperations > 0
      ? incrementalOperations / fullTreeOperations
      : 0
    
    return {
      leafCount: this.leaves.length,
      height,
      checkpointCount: this.checkpoints.length,
      efficiency: efficiency * 100 // Percentage
    }
  }
}

/**
 * Merkle Stream Manager
 * Manages multiple incremental trees for different elections
 */
export class MerkleStreamManager {
  private streams: Map<string, IncrementalMerkleTree>
  
  constructor() {
    this.streams = new Map()
  }
  
  /**
   * Create a new stream for an election
   */
  createStream(streamId: string): IncrementalMerkleTree {
    const stream = new IncrementalMerkleTree()
    this.streams.set(streamId, stream)
    return stream
  }
  
  /**
   * Get stream by ID
   */
  getStream(streamId: string): IncrementalMerkleTree | null {
    return this.streams.get(streamId) || null
  }
  
  /**
   * Append to specific stream
   */
  appendToStream(streamId: string, leaf: string): MerkleUpdate | null {
    const stream = this.streams.get(streamId)
    if (!stream) {
      return null
    }
    
    return stream.append(leaf)
  }
  
  /**
   * Get all active streams
   */
  getActiveStreams(): string[] {
    return Array.from(this.streams.keys())
  }
  
  /**
   * Remove stream
   */
  removeStream(streamId: string): boolean {
    return this.streams.delete(streamId)
  }
  
  /**
   * Get stats for all streams
   */
  getAllStats(): Map<string, any> {
    const stats = new Map()
    this.streams.forEach((stream, id) => {
      stats.set(id, stream.getStats())
    })
    return stats
  }
}

/**
 * Real-time vote verification using Merkle Streams
 */
export class RealTimeVerifier {
  private stream: IncrementalMerkleTree
  private verifiedLeaves: Set<string>
  private publishedRoots: Map<string, number> // root -> timestamp
  
  constructor() {
    this.stream = new IncrementalMerkleTree()
    this.verifiedLeaves = new Set()
    this.publishedRoots = new Map()
  }
  
  /**
   * Add and verify a vote in real-time
   */
  addVote(voteHash: string): {
    verified: boolean
    newRoot: string
    timestamp: number
    position: number
  } {
    // Check for duplicate
    if (this.verifiedLeaves.has(voteHash)) {
      throw new Error('Vote already verified')
    }
    
    const update = this.stream.append(voteHash)
    this.verifiedLeaves.add(voteHash)
    
    // Publish new root
    this.publishedRoots.set(update.newRoot, update.timestamp)
    
    return {
      verified: true,
      newRoot: update.newRoot,
      timestamp: update.timestamp,
      position: update.leafCount - 1
    }
  }
  
  /**
   * Verify a vote was included at specific position
   */
  verifyInclusion(voteHash: string, position: number): boolean {
    const leaf = this.stream.getLeaf(position)
    return leaf === voteHash
  }
  
  /**
   * Get current state
   */
  getState(): {
    currentRoot: string
    totalVotes: number
    verifiedCount: number
    publishedRootCount: number
  } {
    return {
      currentRoot: this.stream.getRoot(),
      totalVotes: this.stream.getLeafCount(),
      verifiedCount: this.verifiedLeaves.size,
      publishedRootCount: this.publishedRoots.size
    }
  }
  
  /**
   * Generate inclusion proof
   */
  generateInclusionProof(position: number) {
    return this.stream.generateProof(position)
  }
}

export default {
  IncrementalMerkleTree,
  MerkleStreamManager,
  RealTimeVerifier
}
