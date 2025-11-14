/**
 * Vote Recovery Module
 * 
 * Allows voters to recover their voting credentials if lost,
 * using Shamir Secret Sharing to split recovery keys among
 * trusted guardians or distributed storage.
 * 
 * Features:
 * - K-of-N recovery (need K guardians to recover)
 * - Time-locked recovery (prevent immediate access)
 * - Social recovery (trusted friends/family)
 * - Hardware recovery (multiple devices)
 */

import { generateCredential, sha256, generateRandomness, hashPassword } from '../crypto/index.js'
import { ShamirSecretSharing } from '../threshold/index.js'

export interface RecoveryGuardian {
  id: string
  name: string
  contact: string  // Email or phone
  publicKey: string
  shareIndex: number
  active: boolean
  lastContact: number
}

export interface RecoveryConfig {
  voterId: string
  threshold: number       // K guardians needed
  totalGuardians: number  // N total guardians
  guardians: RecoveryGuardian[]
  timeLockHours: number   // Hours before recovery can be executed
  createdAt: number
}

export interface RecoveryShare {
  guardianId: string
  encryptedShare: string
  shareIndex: number
  ballotId: string
}

export interface RecoveryRequest {
  requestId: string
  voterId: string
  requestedAt: number
  unlockTime: number
  approvals: Map<string, RecoveryApproval>
  status: 'pending' | 'approved' | 'rejected' | 'executed'
}

export interface RecoveryApproval {
  guardianId: string
  approved: boolean
  share: string
  timestamp: number
  signature: string
}

/**
 * Vote Recovery System
 */
export class VoteRecoverySystem {
  private secretSharing: ShamirSecretSharing
  private recoveryConfigs: Map<string, RecoveryConfig>
  private recoveryShares: Map<string, RecoveryShare[]>
  private recoveryRequests: Map<string, RecoveryRequest>
  
  constructor() {
    this.secretSharing = new ShamirSecretSharing()
    this.recoveryConfigs = new Map()
    this.recoveryShares = new Map()
    this.recoveryRequests = new Map()
  }
  
  /**
   * Setup recovery for a voter
   */
  setupRecovery(
    voterId: string,
    votingKey: string,
    guardians: RecoveryGuardian[],
    threshold: number,
    timeLockHours: number = 24
  ): RecoveryConfig {
    if (threshold > guardians.length) {
      throw new Error('Threshold cannot exceed number of guardians')
    }
    
    if (guardians.length < 2) {
      throw new Error('Need at least 2 guardians')
    }
    
    // Convert voting key to bigint for secret sharing
    const keyBuffer = Buffer.from(votingKey, 'hex')
    let keyBigInt = 0n
    for (const byte of keyBuffer) {
      keyBigInt = (keyBigInt << 8n) | BigInt(byte)
    }
    
    // Split secret into shares
    const shares = this.secretSharing.split(keyBigInt, threshold, guardians.length)
    
    // Distribute shares to guardians
    const recoveryShares: RecoveryShare[] = []
    
    guardians.forEach((guardian, index) => {
      const shareHex = shares[index].toString(16).padStart(64, '0')
      
      // Encrypt share with guardian's public key (simplified - use real encryption)
      const encryptedShare = this.encryptShareForGuardian(shareHex, guardian.publicKey)
      
      const recoveryShare: RecoveryShare = {
        guardianId: guardian.id,
        encryptedShare,
        shareIndex: index + 1,
        ballotId: voterId
      }
      
      recoveryShares.push(recoveryShare)
      guardian.shareIndex = index + 1
    })
    
    const config: RecoveryConfig = {
      voterId,
      threshold,
      totalGuardians: guardians.length,
      guardians,
      timeLockHours,
      createdAt: Date.now()
    }
    
    this.recoveryConfigs.set(voterId, config)
    this.recoveryShares.set(voterId, recoveryShares)
    
    return config
  }
  
  /**
   * Initiate recovery request
   */
  initiateRecovery(voterId: string): RecoveryRequest {
    const config = this.recoveryConfigs.get(voterId)
    if (!config) {
      throw new Error('No recovery configuration found')
    }
    
    const requestId = generateCredential()
    const now = Date.now()
    const unlockTime = now + (config.timeLockHours * 60 * 60 * 1000)
    
    const request: RecoveryRequest = {
      requestId,
      voterId,
      requestedAt: now,
      unlockTime,
      approvals: new Map(),
      status: 'pending'
    }
    
    this.recoveryRequests.set(requestId, request)
    
    // Notify guardians (in real system, send notifications)
    config.guardians.forEach(guardian => {
      console.log(`Notifying guardian ${guardian.name} at ${guardian.contact}`)
    })
    
    return request
  }
  
  /**
   * Guardian approves recovery
   */
  approveRecovery(
    requestId: string,
    guardianId: string,
    signature: string
  ): boolean {
    const request = this.recoveryRequests.get(requestId)
    if (!request) {
      return false
    }
    
    const config = this.recoveryConfigs.get(request.voterId)
    if (!config) {
      return false
    }
    
    // Verify guardian is valid
    const guardian = config.guardians.find(g => g.id === guardianId)
    if (!guardian || !guardian.active) {
      return false
    }
    
    // Get guardian's share
    const shares = this.recoveryShares.get(request.voterId)
    if (!shares) {
      return false
    }
    
    const guardianShare = shares.find(s => s.guardianId === guardianId)
    if (!guardianShare) {
      return false
    }
    
    // Create approval
    const approval: RecoveryApproval = {
      guardianId,
      approved: true,
      share: guardianShare.encryptedShare,
      timestamp: Date.now(),
      signature
    }
    
    request.approvals.set(guardianId, approval)
    
    // Check if we have enough approvals
    if (request.approvals.size >= config.threshold) {
      request.status = 'approved'
    }
    
    return true
  }
  
  /**
   * Execute recovery (after time lock and enough approvals)
   */
  executeRecovery(requestId: string): string | null {
    const request = this.recoveryRequests.get(requestId)
    if (!request) {
      return null
    }
    
    const config = this.recoveryConfigs.get(request.voterId)
    if (!config) {
      return null
    }
    
    // Check time lock
    if (Date.now() < request.unlockTime) {
      throw new Error(`Recovery locked until ${new Date(request.unlockTime).toISOString()}`)
    }
    
    // Check enough approvals
    if (request.approvals.size < config.threshold) {
      throw new Error(`Need ${config.threshold} approvals, have ${request.approvals.size}`)
    }
    
    // Decrypt shares from guardians
    const shareMap = new Map<number, bigint>()
    
    request.approvals.forEach((approval, guardianId) => {
      const guardian = config.guardians.find(g => g.id === guardianId)
      if (guardian) {
        // Decrypt share (simplified - use real decryption)
        const decryptedShare = this.decryptShareFromGuardian(
          approval.share,
          guardian.publicKey
        )
        shareMap.set(guardian.shareIndex, BigInt('0x' + decryptedShare))
      }
    })
    
    // Reconstruct secret
    const reconstructedSecret = this.secretSharing.combine(shareMap)
    
    // Convert back to hex string
    const recoveredKey = reconstructedSecret.toString(16).padStart(64, '0')
    
    request.status = 'executed'
    
    return recoveredKey
  }
  
  /**
   * Cancel recovery request
   */
  cancelRecovery(requestId: string, voterId: string): boolean {
    const request = this.recoveryRequests.get(requestId)
    if (!request || request.voterId !== voterId) {
      return false
    }
    
    request.status = 'rejected'
    return true
  }
  
  /**
   * Update guardians
   */
  updateGuardians(
    voterId: string,
    votingKey: string,
    newGuardians: RecoveryGuardian[]
  ): boolean {
    const oldConfig = this.recoveryConfigs.get(voterId)
    if (!oldConfig) {
      return false
    }
    
    // Setup new recovery with updated guardians
    this.setupRecovery(
      voterId,
      votingKey,
      newGuardians,
      oldConfig.threshold,
      oldConfig.timeLockHours
    )
    
    return true
  }
  
  /**
   * Get recovery status
   */
  getRecoveryStatus(requestId: string): RecoveryRequest | null {
    return this.recoveryRequests.get(requestId) || null
  }
  
  /**
   * Get recovery configuration
   */
  getRecoveryConfig(voterId: string): RecoveryConfig | null {
    return this.recoveryConfigs.get(voterId) || null
  }
  
  /**
   * Test recovery (without actually executing)
   */
  testRecovery(voterId: string): {
    canRecover: boolean
    activeGuardians: number
    requiredGuardians: number
    estimatedRecoveryTime: number
  } {
    const config = this.recoveryConfigs.get(voterId)
    if (!config) {
      return {
        canRecover: false,
        activeGuardians: 0,
        requiredGuardians: 0,
        estimatedRecoveryTime: 0
      }
    }
    
    const activeGuardians = config.guardians.filter(g => g.active).length
    const canRecover = activeGuardians >= config.threshold
    
    return {
      canRecover,
      activeGuardians,
      requiredGuardians: config.threshold,
      estimatedRecoveryTime: config.timeLockHours * 60 * 60 * 1000
    }
  }
  
  /**
   * Encrypt share for guardian (simplified)
   */
  private encryptShareForGuardian(share: string, publicKey: string): string {
    // In real implementation, use proper asymmetric encryption
    const combined = share + publicKey
    return sha256(Buffer.from(combined)).toString('hex')
  }
  
  /**
   * Decrypt share from guardian (simplified)
   */
  private decryptShareFromGuardian(encryptedShare: string, publicKey: string): string {
    // In real implementation, use proper asymmetric decryption
    // For now, return mock decrypted share
    return encryptedShare.substring(0, 64)
  }
  
  /**
   * Get statistics
   */
  getStats(): {
    totalConfigs: number
    totalRequests: number
    pendingRequests: number
    approvedRequests: number
    executedRequests: number
    averageGuardiansPerConfig: number
  } {
    let totalGuardians = 0
    this.recoveryConfigs.forEach(config => {
      totalGuardians += config.guardians.length
    })
    
    let pendingCount = 0
    let approvedCount = 0
    let executedCount = 0
    
    this.recoveryRequests.forEach(request => {
      if (request.status === 'pending') pendingCount++
      if (request.status === 'approved') approvedCount++
      if (request.status === 'executed') executedCount++
    })
    
    return {
      totalConfigs: this.recoveryConfigs.size,
      totalRequests: this.recoveryRequests.size,
      pendingRequests: pendingCount,
      approvedRequests: approvedCount,
      executedRequests: executedCount,
      averageGuardiansPerConfig: this.recoveryConfigs.size > 0
        ? totalGuardians / this.recoveryConfigs.size
        : 0
    }
  }
}

/**
 * Multi-Device Recovery
 * Alternative recovery method using multiple devices
 */
export class MultiDeviceRecovery {
  private deviceShares: Map<string, Map<string, string>>  // voterId -> deviceId -> share
  
  constructor() {
    this.deviceShares = new Map()
  }
  
  /**
   * Setup multi-device recovery
   */
  setupDevices(
    voterId: string,
    votingKey: string,
    deviceIds: string[],
    threshold: number
  ): Map<string, string> {
    const secretSharing = new ShamirSecretSharing()
    
    const keyBuffer = Buffer.from(votingKey, 'hex')
    let keyBigInt = 0n
    for (const byte of keyBuffer) {
      keyBigInt = (keyBigInt << 8n) | BigInt(byte)
    }
    
    const shares = secretSharing.split(keyBigInt, threshold, deviceIds.length)
    
    const deviceSharesMap = new Map<string, string>()
    
    deviceIds.forEach((deviceId, index) => {
      const shareHex = shares[index].toString(16).padStart(64, '0')
      deviceSharesMap.set(deviceId, shareHex)
    })
    
    this.deviceShares.set(voterId, deviceSharesMap)
    
    return deviceSharesMap
  }
  
  /**
   * Recover using K devices
   */
  recoverFromDevices(
    voterId: string,
    deviceShares: Map<string, string>,
    threshold: number
  ): string {
    const secretSharing = new ShamirSecretSharing()
    
    if (deviceShares.size < threshold) {
      throw new Error(`Need ${threshold} devices, have ${deviceShares.size}`)
    }
    
    const shareMap = new Map<number, bigint>()
    let index = 1
    
    deviceShares.forEach((share) => {
      shareMap.set(index, BigInt('0x' + share))
      index++
    })
    
    const reconstructedSecret = secretSharing.combine(shareMap)
    return reconstructedSecret.toString(16).padStart(64, '0')
  }
}

export default {
  VoteRecoverySystem,
  MultiDeviceRecovery
}
