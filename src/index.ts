/**
 * BSV Voting System - Main Entry Point
 * 
 * Transparent, verifiable, privacy-preserving electronic voting
 * Built on BSV blockchain with zero-knowledge proofs
 */

import dotenv from 'dotenv'
import pino from 'pino'

// Load environment variables
dotenv.config()

// Initialize logger
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname'
    }
  }
})

// Export modules
export * from './contracts/VoteTicket.js'
export * from './contracts/VotingRegistry.js'
export * as crypto from './modules/crypto/index.js'
export * as merkle from './modules/merkle/index.js'
export * as zkproof from './modules/zkproof/index.js'

// Application metadata
export const APP_INFO = {
  name: 'BSV Voting System',
  version: '1.0.0',
  description: 'Transparent, verifiable, privacy-preserving electronic voting',
  repository: 'https://github.com/frogitzamna-wq/voting-system',
  author: 'Raul Licea Yañez',
  license: 'MIT'
}

/**
 * Main application entry
 */
async function main() {
  logger.info(`Starting ${APP_INFO.name} v${APP_INFO.version}`)
  logger.info('Environment:', process.env.NODE_ENV || 'development')
  
  // Configuration validation
  const requiredEnvVars = [
    'DATABASE_URL',
    'BSV_NETWORK',
    'REDIS_URL'
  ]
  
  const missingVars = requiredEnvVars.filter(v => !process.env[v])
  
  if (missingVars.length > 0) {
    logger.error('Missing required environment variables:', missingVars)
    logger.error('Please check your .env file')
    process.exit(1)
  }
  
  logger.info('Configuration validated successfully')
  logger.info('Network:', process.env.BSV_NETWORK)
  logger.info('Database:', process.env.DATABASE_URL?.split('@')[1])
  
  // Ready to start services
  logger.info(`${APP_INFO.name} initialized successfully`)
  logger.info('Ready to process votes 🗳️')
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logger.error('Fatal error:', error)
    process.exit(1)
  })
}

export default {
  APP_INFO,
  logger
}
