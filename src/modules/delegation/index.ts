/**
 * Liquid Democracy Module
 * 
 * Enables transitive vote delegation where voters can:
 * 1. Vote directly
 * 2. Delegate their vote to a trusted representative
 * 3. Revoke delegation and vote directly
 * 4. Create delegation chains (A → B → C)
 * 
 * Privacy: Delegations are public, but final votes remain private
 */

import { generateCredential, generateNullifier, sha256 } from '../crypto/index.js'

export interface Delegation {
  delegatorId: string        // Who is delegating
  delegateId: string          // Who receives the delegation
  ballotId: string            // Which election
  delegationTxId: string      // Blockchain TX ID
  timestamp: number           // When delegated
  active: boolean             // Can be revoked
  weight: number              // Vote weight (1 + subdelegations)
}

export interface DelegationChain {
  chain: string[]             // [voter, delegate1, delegate2, ...]
  finalVoterId: string        // Who actually votes
  totalWeight: number         // Accumulated weight
  depth: number               // Chain length
}

export interface VoteWithDelegation {
  voterId: string
  directVote: boolean         // True if voter voted directly
  delegatedFrom: string[]     // List of voters who delegated to this voter
  totalWeight: number         // 1 + number of delegations
}

/**
 * Delegation Registry
 * Tracks all delegations for an election
 */
export class DelegationRegistry {
  private delegations: Map<string, Delegation>
  private delegationsByDelegator: Map<string, string> // delegatorId -> delegateId
  private delegationsByDelegate: Map<string, Set<string>> // delegateId -> Set<delegatorIds>
  private votesCast: Set<string> // Voters who cast direct votes (revokes delegation)
  
  constructor() {
    this.delegations = new Map()
    this.delegationsByDelegator = new Map()
    this.delegationsByDelegate = new Map()
    this.votesCast = new Set()
  }
  
  /**
   * Register a delegation
   */
  delegate(
    delegatorId: string,
    delegateId: string,
    ballotId: string
  ): Delegation {
    // Prevent self-delegation
    if (delegatorId === delegateId) {
      throw new Error('Cannot delegate to yourself')
    }
    
    // Prevent circular delegation
    if (this.wouldCreateCycle(delegatorId, delegateId)) {
      throw new Error('Circular delegation detected')
    }
    
    // Revoke previous delegation if exists
    this.revokeDelegation(delegatorId, ballotId)
    
    const delegation: Delegation = {
      delegatorId,
      delegateId,
      ballotId,
      delegationTxId: generateCredential(), // Would be real TX ID
      timestamp: Date.now(),
      active: true,
      weight: 1 // Will be updated when computing chains
    }
    
    const delegationId = `${delegatorId}-${ballotId}`
    this.delegations.set(delegationId, delegation)
    this.delegationsByDelegator.set(delegatorId, delegateId)
    
    // Track reverse mapping
    if (!this.delegationsByDelegate.has(delegateId)) {
      this.delegationsByDelegate.set(delegateId, new Set())
    }
    this.delegationsByDelegate.get(delegateId)!.add(delegatorId)
    
    return delegation
  }
  
  /**
   * Revoke a delegation
   */
  revokeDelegation(delegatorId: string, ballotId: string): boolean {
    const delegationId = `${delegatorId}-${ballotId}`
    const delegation = this.delegations.get(delegationId)
    
    if (!delegation || !delegation.active) {
      return false
    }
    
    delegation.active = false
    this.delegationsByDelegator.delete(delegatorId)
    
    // Remove from reverse mapping
    const delegateId = delegation.delegateId
    const delegators = this.delegationsByDelegate.get(delegateId)
    if (delegators) {
      delegators.delete(delegatorId)
    }
    
    return true
  }
  
  /**
   * Cast a direct vote (automatically revokes delegation)
   */
  castDirectVote(voterId: string, ballotId: string): void {
    this.revokeDelegation(voterId, ballotId)
    this.votesCast.add(voterId)
  }
  
  /**
   * Check if delegation would create a cycle
   */
  private wouldCreateCycle(delegatorId: string, delegateId: string): boolean {
    const visited = new Set<string>()
    let current = delegateId
    
    while (current) {
      if (visited.has(current)) {
        return true // Cycle detected
      }
      if (current === delegatorId) {
        return true // Would create cycle
      }
      
      visited.add(current)
      current = this.delegationsByDelegator.get(current) || ''
    }
    
    return false
  }
  
  /**
   * Resolve delegation chain for a voter
   */
  resolveDelegationChain(voterId: string): DelegationChain {
    const chain: string[] = [voterId]
    let current = voterId
    let depth = 0
    const maxDepth = 100 // Prevent infinite loops
    
    while (depth < maxDepth) {
      // If voter cast direct vote, chain ends here
      if (this.votesCast.has(current)) {
        break
      }
      
      // Follow delegation
      const nextDelegate = this.delegationsByDelegator.get(current)
      if (!nextDelegate) {
        break // No delegation, chain ends
      }
      
      chain.push(nextDelegate)
      current = nextDelegate
      depth++
    }
    
    // Count total weight (delegator + all who delegated to them)
    const finalVoterId = chain[chain.length - 1]
    const totalWeight = this.calculateVoteWeight(finalVoterId)
    
    return {
      chain,
      finalVoterId,
      totalWeight,
      depth: chain.length - 1
    }
  }
  
  /**
   * Calculate vote weight for a voter
   * (1 for self + number of active delegations to this voter)
   */
  calculateVoteWeight(voterId: string): number {
    let weight = 1 // Self
    
    const delegators = this.delegationsByDelegate.get(voterId)
    if (delegators) {
      // Recursively count delegations
      delegators.forEach(delegatorId => {
        if (!this.votesCast.has(delegatorId)) {
          weight += this.calculateVoteWeight(delegatorId)
        }
      })
    }
    
    return weight
  }
  
  /**
   * Get all active delegations
   */
  getActiveDelegations(): Delegation[] {
    return Array.from(this.delegations.values()).filter(d => d.active)
  }
  
  /**
   * Get delegations for a specific delegator
   */
  getDelegation(delegatorId: string, ballotId: string): Delegation | null {
    const delegationId = `${delegatorId}-${ballotId}`
    return this.delegations.get(delegationId) || null
  }
  
  /**
   * Get all voters who delegated to a specific delegate
   */
  getDelegatorsFor(delegateId: string): string[] {
    const delegators = this.delegationsByDelegate.get(delegateId)
    return delegators ? Array.from(delegators) : []
  }
  
  /**
   * Get delegation statistics
   */
  getStats(): {
    totalDelegations: number
    activeDelegations: number
    directVotes: number
    averageChainLength: number
    longestChain: number
    totalVoteWeight: number
  } {
    const activeDelegations = this.getActiveDelegations()
    const directVotes = this.votesCast.size
    
    // Calculate chain statistics
    let totalChainLength = 0
    let longestChain = 0
    const processedVoters = new Set<string>()
    
    this.delegations.forEach((delegation, key) => {
      const voterId = delegation.delegatorId
      if (!processedVoters.has(voterId)) {
        const chain = this.resolveDelegationChain(voterId)
        totalChainLength += chain.depth
        longestChain = Math.max(longestChain, chain.depth)
        processedVoters.add(voterId)
      }
    })
    
    const averageChainLength = processedVoters.size > 0
      ? totalChainLength / processedVoters.size
      : 0
    
    // Calculate total vote weight
    const finalVoters = new Set<string>()
    processedVoters.forEach(voterId => {
      const chain = this.resolveDelegationChain(voterId)
      finalVoters.add(chain.finalVoterId)
    })
    
    let totalVoteWeight = 0
    finalVoters.forEach(voterId => {
      totalVoteWeight += this.calculateVoteWeight(voterId)
    })
    
    return {
      totalDelegations: this.delegations.size,
      activeDelegations: activeDelegations.length,
      directVotes,
      averageChainLength,
      longestChain,
      totalVoteWeight
    }
  }
  
  /**
   * Export delegation graph for visualization
   */
  exportGraph(): {
    nodes: Array<{ id: string; weight: number; isDelegate: boolean }>
    edges: Array<{ from: string; to: string; active: boolean }>
  } {
    const nodes = new Map<string, { id: string; weight: number; isDelegate: boolean }>()
    const edges: Array<{ from: string; to: string; active: boolean }> = []
    
    this.delegations.forEach(delegation => {
      // Add nodes
      if (!nodes.has(delegation.delegatorId)) {
        nodes.set(delegation.delegatorId, {
          id: delegation.delegatorId,
          weight: this.calculateVoteWeight(delegation.delegatorId),
          isDelegate: this.delegationsByDelegate.has(delegation.delegatorId)
        })
      }
      
      if (!nodes.has(delegation.delegateId)) {
        nodes.set(delegation.delegateId, {
          id: delegation.delegateId,
          weight: this.calculateVoteWeight(delegation.delegateId),
          isDelegate: true
        })
      }
      
      // Add edge
      edges.push({
        from: delegation.delegatorId,
        to: delegation.delegateId,
        active: delegation.active
      })
    })
    
    return {
      nodes: Array.from(nodes.values()),
      edges
    }
  }
}

/**
 * Create nullifier for delegated vote
 * Prevents both delegator and delegate from voting on same ballot
 */
export function generateDelegationNullifier(
  delegatorId: string,
  delegateId: string,
  ballotId: string
): string {
  const data = Buffer.concat([
    Buffer.from(delegatorId, 'hex'),
    Buffer.from(delegateId, 'hex'),
    Buffer.from(ballotId, 'hex')
  ])
  return sha256(data).toString('hex')
}

/**
 * Verify delegation chain is valid
 */
export function verifyDelegationChain(
  chain: DelegationChain,
  registry: DelegationRegistry
): boolean {
  for (let i = 0; i < chain.chain.length - 1; i++) {
    const delegatorId = chain.chain[i]
    const expectedDelegateId = chain.chain[i + 1]
    
    // Verify each link in chain
    const delegation = registry.getDelegation(delegatorId, 'ballot-id') // Would use real ballot ID
    if (!delegation || !delegation.active) {
      return false
    }
    if (delegation.delegateId !== expectedDelegateId) {
      return false
    }
  }
  
  return true
}

export default {
  DelegationRegistry,
  generateDelegationNullifier,
  verifyDelegationChain
}
