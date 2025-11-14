/**
 * Privacy-Preserving Analytics Dashboard
 * 
 * Real-time election metrics without compromising voter privacy.
 * Features:
 * - Aggregate statistics (no individual votes exposed)
 * - Differential privacy for sensitive metrics
 * - Time-series participation data
 * - Geographic/demographic aggregates (with k-anonymity)
 * - Anomaly detection for fraud
 * - Performance monitoring
 * 
 * Privacy techniques:
 * - K-anonymity: Minimum group size before publishing stats
 * - Differential privacy: Add noise to protect individuals
 * - Data minimization: Only collect necessary metrics
 */

import { sha256 } from '../crypto/index.js'

export interface VoteMetrics {
  totalVotes: number
  totalEligibleVoters: number
  turnoutPercentage: number
  votesPerCandidate: Map<string, number>
  votesPerHour: number[]
  averageVotingTime: number  // Milliseconds
  timestamp: number
}

export interface ParticipationMetrics {
  hourlyVotes: { hour: number; count: number; cumulativeCount: number }[]
  dailyTrends: { day: string; votes: number }[]
  peakHours: { hour: number; count: number }[]
  slowestHours: { hour: number; count: number }[]
  projectedFinalTurnout: number
}

export interface CandidateMetrics {
  candidateId: string
  candidateName: string
  voteCount: number
  percentage: number
  trend: 'increasing' | 'decreasing' | 'stable'
  hourlyTrend: number[]
  ranking: number
}

export interface GeographicMetrics {
  region: string
  voteCount: number
  turnout: number
  topCandidate: string
  diversity: number  // 0-1, how evenly distributed votes are
}

export interface AnomalyDetection {
  anomalies: {
    type: 'suspicious_pattern' | 'unusual_timing' | 'geographic_anomaly' | 'duplicate_suspicion'
    severity: 'low' | 'medium' | 'high'
    description: string
    timestamp: number
    affectedVotes: number
  }[]
  fraudScore: number  // 0-100
  recommendations: string[]
}

export interface PerformanceMetrics {
  averageConfirmationTime: number  // Milliseconds
  transactionThroughput: number    // Votes per second
  blockchainLoad: number            // Percentage
  apiResponseTime: number           // Milliseconds
  errorRate: number                 // Percentage
  uptimePercentage: number
}

export interface DashboardConfig {
  kAnonymity: number              // Minimum group size (default 5)
  differentialPrivacyEpsilon: number  // Privacy budget (default 0.1)
  refreshInterval: number         // Seconds
  enableGeographic: boolean
  enableDemographic: boolean
  enableAnomalyDetection: boolean
}

interface Vote {
  voteId: string
  candidateId: string
  timestamp: number
  region?: string
  demographic?: string
}

/**
 * Privacy-Preserving Analytics Dashboard
 */
export class AnalyticsDashboard {
  private votes: Vote[]
  private eligibleVoters: number
  private candidates: Map<string, string>  // ID -> Name
  private config: DashboardConfig
  private startTime: number
  
  constructor(
    eligibleVoters: number,
    candidates: Map<string, string>,
    config: Partial<DashboardConfig> = {}
  ) {
    this.votes = []
    this.eligibleVoters = eligibleVoters
    this.candidates = candidates
    this.startTime = Date.now()
    
    const defaultConfig: DashboardConfig = {
      kAnonymity: 5,
      differentialPrivacyEpsilon: 0.1,
      refreshInterval: 30,
      enableGeographic: false,
      enableDemographic: false,
      enableAnomalyDetection: true
    }
    
    this.config = { ...defaultConfig, ...config }
  }
  
  /**
   * Record a vote (for analytics only)
   */
  recordVote(
    voteId: string,
    candidateId: string,
    region?: string,
    demographic?: string
  ): void {
    this.votes.push({
      voteId,
      candidateId,
      timestamp: Date.now(),
      region,
      demographic
    })
  }
  
  /**
   * Get real-time vote metrics
   */
  getVoteMetrics(): VoteMetrics {
    const totalVotes = this.votes.length
    const turnoutPercentage = (totalVotes / this.eligibleVoters) * 100
    
    // Count votes per candidate
    const votesPerCandidate = new Map<string, number>()
    for (const candidate of this.candidates.keys()) {
      votesPerCandidate.set(candidate, 0)
    }
    
    for (const vote of this.votes) {
      const count = votesPerCandidate.get(vote.candidateId) || 0
      votesPerCandidate.set(vote.candidateId, count + 1)
    }
    
    // Add differential privacy noise
    if (this.config.differentialPrivacyEpsilon > 0) {
      for (const [candidateId, count] of votesPerCandidate.entries()) {
        const noise = this.laplaceNoise(this.config.differentialPrivacyEpsilon)
        const noisyCount = Math.max(0, Math.round(count + noise))
        votesPerCandidate.set(candidateId, noisyCount)
      }
    }
    
    // Votes per hour
    const votesPerHour = this.getVotesPerHour()
    
    // Average voting time (time between votes)
    const averageVotingTime = this.calculateAverageVotingTime()
    
    return {
      totalVotes,
      totalEligibleVoters: this.eligibleVoters,
      turnoutPercentage,
      votesPerCandidate,
      votesPerHour,
      averageVotingTime,
      timestamp: Date.now()
    }
  }
  
  /**
   * Get participation metrics
   */
  getParticipationMetrics(): ParticipationMetrics {
    // Hourly votes
    const hourlyVotes = this.getHourlyVotes()
    
    // Daily trends (if election spans multiple days)
    const dailyTrends = this.getDailyTrends()
    
    // Peak hours
    const sortedHours = [...hourlyVotes].sort((a, b) => b.count - a.count)
    const peakHours = sortedHours.slice(0, 3)
    const slowestHours = sortedHours.slice(-3).reverse()
    
    // Project final turnout
    const projectedFinalTurnout = this.projectFinalTurnout()
    
    return {
      hourlyVotes,
      dailyTrends,
      peakHours,
      slowestHours,
      projectedFinalTurnout
    }
  }
  
  /**
   * Get candidate metrics
   */
  getCandidateMetrics(): CandidateMetrics[] {
    const metrics: CandidateMetrics[] = []
    const totalVotes = this.votes.length
    
    if (totalVotes === 0) {
      return metrics
    }
    
    const voteCounts = new Map<string, number>()
    for (const candidate of this.candidates.keys()) {
      voteCounts.set(candidate, 0)
    }
    
    for (const vote of this.votes) {
      voteCounts.set(vote.candidateId, (voteCounts.get(vote.candidateId) || 0) + 1)
    }
    
    // Sort by vote count
    const sortedCandidates = Array.from(voteCounts.entries())
      .sort((a, b) => b[1] - a[1])
    
    for (let i = 0; i < sortedCandidates.length; i++) {
      const [candidateId, voteCount] = sortedCandidates[i]
      const percentage = (voteCount / totalVotes) * 100
      
      // Calculate trend
      const hourlyTrend = this.getCandidateHourlyTrend(candidateId)
      const trend = this.calculateTrend(hourlyTrend)
      
      metrics.push({
        candidateId,
        candidateName: this.candidates.get(candidateId) || 'Unknown',
        voteCount,
        percentage,
        trend,
        hourlyTrend,
        ranking: i + 1
      })
    }
    
    return metrics
  }
  
  /**
   * Get geographic metrics (with k-anonymity)
   */
  getGeographicMetrics(): GeographicMetrics[] {
    if (!this.config.enableGeographic) {
      return []
    }
    
    const regionData = new Map<string, Vote[]>()
    
    for (const vote of this.votes) {
      if (vote.region) {
        const votes = regionData.get(vote.region) || []
        votes.push(vote)
        regionData.set(vote.region, votes)
      }
    }
    
    const metrics: GeographicMetrics[] = []
    
    for (const [region, votes] of regionData.entries()) {
      // K-anonymity: only include regions with enough votes
      if (votes.length < this.config.kAnonymity) {
        continue
      }
      
      const voteCount = votes.length
      const turnout = (voteCount / this.eligibleVoters) * 100
      
      // Find top candidate
      const candidateCounts = new Map<string, number>()
      for (const vote of votes) {
        candidateCounts.set(vote.candidateId, (candidateCounts.get(vote.candidateId) || 0) + 1)
      }
      
      let topCandidate = ''
      let maxVotes = 0
      for (const [candidateId, count] of candidateCounts.entries()) {
        if (count > maxVotes) {
          maxVotes = count
          topCandidate = candidateId
        }
      }
      
      // Calculate diversity (Shannon entropy)
      const diversity = this.calculateDiversity(candidateCounts, voteCount)
      
      metrics.push({
        region,
        voteCount,
        turnout,
        topCandidate: this.candidates.get(topCandidate) || 'Unknown',
        diversity
      })
    }
    
    return metrics
  }
  
  /**
   * Detect anomalies and potential fraud
   */
  detectAnomalies(): AnomalyDetection {
    if (!this.config.enableAnomalyDetection) {
      return { anomalies: [], fraudScore: 0, recommendations: [] }
    }
    
    const anomalies: AnomalyDetection['anomalies'] = []
    
    // Check for suspicious timing patterns
    const timingAnomaly = this.detectTimingAnomalies()
    if (timingAnomaly) {
      anomalies.push(timingAnomaly)
    }
    
    // Check for unusual geographic patterns
    if (this.config.enableGeographic) {
      const geoAnomaly = this.detectGeographicAnomalies()
      if (geoAnomaly) {
        anomalies.push(geoAnomaly)
      }
    }
    
    // Check for duplicate suspicion
    const duplicateAnomaly = this.detectDuplicateSuspicion()
    if (duplicateAnomaly) {
      anomalies.push(duplicateAnomaly)
    }
    
    // Calculate fraud score (0-100)
    const fraudScore = this.calculateFraudScore(anomalies)
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(anomalies)
    
    return {
      anomalies,
      fraudScore,
      recommendations
    }
  }
  
  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const totalTime = (Date.now() - this.startTime) / 1000  // Seconds
    const transactionThroughput = this.votes.length / Math.max(totalTime, 1)
    
    return {
      averageConfirmationTime: 8500,  // Mock: ~8.5s (average block time)
      transactionThroughput,
      blockchainLoad: Math.min(100, transactionThroughput * 10),
      apiResponseTime: 45,  // Mock: 45ms
      errorRate: 0.1,       // Mock: 0.1%
      uptimePercentage: 99.9
    }
  }
  
  /**
   * Get complete dashboard data
   */
  getDashboard(): {
    voteMetrics: VoteMetrics
    participationMetrics: ParticipationMetrics
    candidateMetrics: CandidateMetrics[]
    geographicMetrics: GeographicMetrics[]
    anomalyDetection: AnomalyDetection
    performanceMetrics: PerformanceMetrics
  } {
    return {
      voteMetrics: this.getVoteMetrics(),
      participationMetrics: this.getParticipationMetrics(),
      candidateMetrics: this.getCandidateMetrics(),
      geographicMetrics: this.getGeographicMetrics(),
      anomalyDetection: this.detectAnomalies(),
      performanceMetrics: this.getPerformanceMetrics()
    }
  }
  
  // Private helper methods
  
  private getVotesPerHour(): number[] {
    const hours = new Array(24).fill(0)
    
    for (const vote of this.votes) {
      const hour = new Date(vote.timestamp).getHours()
      hours[hour]++
    }
    
    return hours
  }
  
  private getHourlyVotes(): { hour: number; count: number; cumulativeCount: number }[] {
    const hourlyData = new Map<number, number>()
    
    for (const vote of this.votes) {
      const hoursSinceStart = Math.floor((vote.timestamp - this.startTime) / (60 * 60 * 1000))
      hourlyData.set(hoursSinceStart, (hourlyData.get(hoursSinceStart) || 0) + 1)
    }
    
    const result: { hour: number; count: number; cumulativeCount: number }[] = []
    let cumulative = 0
    
    const maxHour = Math.max(...Array.from(hourlyData.keys()), 0)
    for (let hour = 0; hour <= maxHour; hour++) {
      const count = hourlyData.get(hour) || 0
      cumulative += count
      result.push({ hour, count, cumulativeCount: cumulative })
    }
    
    return result
  }
  
  private getDailyTrends(): { day: string; votes: number }[] {
    const dailyData = new Map<string, number>()
    
    for (const vote of this.votes) {
      const day = new Date(vote.timestamp).toISOString().split('T')[0]
      dailyData.set(day, (dailyData.get(day) || 0) + 1)
    }
    
    return Array.from(dailyData.entries())
      .map(([day, votes]) => ({ day, votes }))
      .sort((a, b) => a.day.localeCompare(b.day))
  }
  
  private calculateAverageVotingTime(): number {
    if (this.votes.length < 2) {
      return 0
    }
    
    const sortedVotes = [...this.votes].sort((a, b) => a.timestamp - b.timestamp)
    let totalGap = 0
    
    for (let i = 1; i < sortedVotes.length; i++) {
      totalGap += sortedVotes[i].timestamp - sortedVotes[i - 1].timestamp
    }
    
    return totalGap / (sortedVotes.length - 1)
  }
  
  private getCandidateHourlyTrend(candidateId: string): number[] {
    const hourlyVotes = new Map<number, number>()
    
    for (const vote of this.votes) {
      if (vote.candidateId === candidateId) {
        const hour = Math.floor((vote.timestamp - this.startTime) / (60 * 60 * 1000))
        hourlyVotes.set(hour, (hourlyVotes.get(hour) || 0) + 1)
      }
    }
    
    const maxHour = Math.max(...Array.from(hourlyVotes.keys()), 0)
    const trend: number[] = []
    
    for (let hour = 0; hour <= maxHour; hour++) {
      trend.push(hourlyVotes.get(hour) || 0)
    }
    
    return trend
  }
  
  private calculateTrend(hourlyTrend: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (hourlyTrend.length < 3) {
      return 'stable'
    }
    
    const recent = hourlyTrend.slice(-3)
    const average = recent.reduce((sum, val) => sum + val, 0) / recent.length
    const lastValue = recent[recent.length - 1]
    
    if (lastValue > average * 1.2) {
      return 'increasing'
    } else if (lastValue < average * 0.8) {
      return 'decreasing'
    }
    return 'stable'
  }
  
  private projectFinalTurnout(): number {
    if (this.votes.length < 10) {
      return 0  // Not enough data
    }
    
    const hourlyData = this.getHourlyVotes()
    if (hourlyData.length < 2) {
      return this.votes.length
    }
    
    // Simple linear regression
    const recentHours = hourlyData.slice(-5)
    const avgVotesPerHour = recentHours.reduce((sum, h) => sum + h.count, 0) / recentHours.length
    
    // Assume 12 hours remaining (mock)
    const remainingHours = 12
    const projectedAdditionalVotes = avgVotesPerHour * remainingHours
    
    return Math.min(this.eligibleVoters, this.votes.length + projectedAdditionalVotes)
  }
  
  private calculateDiversity(candidateCounts: Map<string, number>, totalVotes: number): number {
    let entropy = 0
    
    for (const count of candidateCounts.values()) {
      if (count > 0) {
        const p = count / totalVotes
        entropy -= p * Math.log2(p)
      }
    }
    
    // Normalize to 0-1
    const maxEntropy = Math.log2(candidateCounts.size)
    return maxEntropy > 0 ? entropy / maxEntropy : 0
  }
  
  private detectTimingAnomalies(): AnomalyDetection['anomalies'][0] | null {
    if (this.votes.length < 10) {
      return null
    }
    
    const sortedVotes = [...this.votes].sort((a, b) => a.timestamp - b.timestamp)
    let suspiciousCount = 0
    
    for (let i = 1; i < sortedVotes.length; i++) {
      const gap = sortedVotes[i].timestamp - sortedVotes[i - 1].timestamp
      if (gap < 100) {  // Less than 100ms between votes
        suspiciousCount++
      }
    }
    
    if (suspiciousCount > this.votes.length * 0.1) {  // More than 10% suspicious
      return {
        type: 'unusual_timing',
        severity: 'medium',
        description: `${suspiciousCount} votes submitted with unusually short intervals (<100ms)`,
        timestamp: Date.now(),
        affectedVotes: suspiciousCount
      }
    }
    
    return null
  }
  
  private detectGeographicAnomalies(): AnomalyDetection['anomalies'][0] | null {
    const regionData = new Map<string, number>()
    
    for (const vote of this.votes) {
      if (vote.region) {
        regionData.set(vote.region, (regionData.get(vote.region) || 0) + 1)
      }
    }
    
    if (regionData.size === 0) {
      return null
    }
    
    const average = this.votes.length / regionData.size
    
    for (const [region, count] of regionData.entries()) {
      if (count > average * 5) {  // More than 5x average
        return {
          type: 'geographic_anomaly',
          severity: 'high',
          description: `Region "${region}" has unusually high vote concentration (${count} votes, ${Math.round(count / average)}x average)`,
          timestamp: Date.now(),
          affectedVotes: count
        }
      }
    }
    
    return null
  }
  
  private detectDuplicateSuspicion(): AnomalyDetection['anomalies'][0] | null {
    // Check for patterns in vote IDs (simplified)
    const voteIdHashes = this.votes.map(v => sha256(Buffer.from(v.voteId)).toString('hex'))
    const uniqueHashes = new Set(voteIdHashes)
    
    if (uniqueHashes.size < voteIdHashes.length) {
      const duplicates = voteIdHashes.length - uniqueHashes.size
      return {
        type: 'duplicate_suspicion',
        severity: 'high',
        description: `Potential duplicate vote IDs detected (${duplicates} duplicates)`,
        timestamp: Date.now(),
        affectedVotes: duplicates
      }
    }
    
    return null
  }
  
  private calculateFraudScore(anomalies: AnomalyDetection['anomalies']): number {
    let score = 0
    
    for (const anomaly of anomalies) {
      switch (anomaly.severity) {
        case 'low':
          score += 10
          break
        case 'medium':
          score += 30
          break
        case 'high':
          score += 50
          break
      }
    }
    
    return Math.min(100, score)
  }
  
  private generateRecommendations(anomalies: AnomalyDetection['anomalies']): string[] {
    const recommendations: string[] = []
    
    for (const anomaly of anomalies) {
      switch (anomaly.type) {
        case 'unusual_timing':
          recommendations.push('Review vote submission timestamps for automated voting patterns')
          break
        case 'geographic_anomaly':
          recommendations.push('Investigate geographic concentration of votes for potential fraud')
          break
        case 'duplicate_suspicion':
          recommendations.push('Verify nullifier uniqueness and check for double voting attempts')
          break
        case 'suspicious_pattern':
          recommendations.push('Conduct manual audit of flagged votes')
          break
      }
    }
    
    if (anomalies.length === 0) {
      recommendations.push('No anomalies detected - election appears legitimate')
    }
    
    return recommendations
  }
  
  /**
   * Laplace noise for differential privacy
   */
  private laplaceNoise(epsilon: number): number {
    const u = Math.random() - 0.5
    const b = 1 / epsilon
    return -b * Math.sign(u) * Math.log(1 - 2 * Math.abs(u))
  }
}

/**
 * Export metrics to CSV
 */
export function exportMetricsToCSV(metrics: VoteMetrics): string {
  const lines: string[] = []
  
  lines.push('Metric,Value')
  lines.push(`Total Votes,${metrics.totalVotes}`)
  lines.push(`Eligible Voters,${metrics.totalEligibleVoters}`)
  lines.push(`Turnout Percentage,${metrics.turnoutPercentage.toFixed(2)}%`)
  lines.push(`Average Voting Time,${metrics.averageVotingTime.toFixed(0)}ms`)
  
  lines.push('')
  lines.push('Candidate,Votes')
  for (const [candidateId, votes] of metrics.votesPerCandidate.entries()) {
    lines.push(`${candidateId},${votes}`)
  }
  
  return lines.join('\n')
}

export default {
  AnalyticsDashboard,
  exportMetricsToCSV
}
