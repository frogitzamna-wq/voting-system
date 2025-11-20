import { bsv, TestWallet, DefaultProvider, sha256, toByteString } from 'scrypt-ts';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

/**
 * Smart Contract Deployment Script for BSV Testnet
 * 
 * Deploys VoteTicket and VotingRegistry contracts
 */

interface DeploymentResult {
  contractName: string;
  txid: string;
  scriptHash: string;
  address: string;
  deployedAt: Date;
}

class ContractDeployer {
  private wallet: TestWallet;
  private provider: DefaultProvider;
  private network: bsv.Networks.Network;

  constructor() {
    this.network = bsv.Networks.testnet;
    this.provider = new DefaultProvider({
      network: this.network,
    });
  }

  async initialize() {
    // Initialize wallet from private key or create new one
    const privateKeyWIF = process.env.BSV_PRIVATE_KEY;
    
    if (privateKeyWIF) {
      this.wallet = TestWallet.fromWIF(privateKeyWIF, this.provider);
    } else {
      console.log('⚠️  No private key found, generating new wallet...');
      this.wallet = TestWallet.random(this.provider);
      console.log('🔑 Private Key (WIF):', this.wallet.privKey.toWIF());
      console.log('📍 Address:', this.wallet.address.toString());
      console.log('⚠️  SAVE THIS KEY SECURELY!');
    }

    await this.wallet.sync();
    const balance = this.wallet.balance;
    
    console.log('💰 Wallet Balance:', balance / 1e8, 'BSV');
    
    if (balance < 10000) {
      throw new Error('Insufficient balance. Fund your wallet at: https://faucet.bsvtest.net/');
    }
  }

  async deployVoteTicket(ballotId: string): Promise<DeploymentResult> {
    console.log('\n📜 Deploying VoteTicket Contract...');

    // Mock contract deployment (replace with actual sCrypt contract compilation)
    const lockingScript = bsv.Script.fromASM(
      `OP_DUP OP_HASH160 ${sha256(toByteString(ballotId)).toString('hex')} OP_EQUALVERIFY OP_CHECKSIG`
    );

    const tx = new bsv.Transaction()
      .from(this.wallet.listUnspent())
      .addOutput(new bsv.Transaction.Output({
        script: lockingScript,
        satoshis: 1000,
      }))
      .change(this.wallet.address)
      .sign(this.wallet.privKey);

    const txid = await this.provider.sendRawTransaction(tx.toString());

    console.log('✅ VoteTicket deployed!');
    console.log('   TX ID:', txid);

    return {
      contractName: 'VoteTicket',
      txid,
      scriptHash: sha256(lockingScript.toBuffer()).toString('hex'),
      address: lockingScript.toAddress(this.network).toString(),
      deployedAt: new Date(),
    };
  }

  async deployVotingRegistry(
    merkleRoot: string,
    ballotId: string
  ): Promise<DeploymentResult> {
    console.log('\n📜 Deploying VotingRegistry Contract...');

    // Mock contract deployment
    const lockingScript = bsv.Script.fromASM(
      `OP_DUP OP_HASH160 ${sha256(toByteString(merkleRoot + ballotId)).toString('hex')} OP_EQUALVERIFY OP_CHECKSIG`
    );

    const tx = new bsv.Transaction()
      .from(this.wallet.listUnspent())
      .addOutput(new bsv.Transaction.Output({
        script: lockingScript,
        satoshis: 2000,
      }))
      .change(this.wallet.address)
      .sign(this.wallet.privKey);

    const txid = await this.provider.sendRawTransaction(tx.toString());

    console.log('✅ VotingRegistry deployed!');
    console.log('   TX ID:', txid);

    return {
      contractName: 'VotingRegistry',
      txid,
      scriptHash: sha256(lockingScript.toBuffer()).toString('hex'),
      address: lockingScript.toAddress(this.network).toString(),
      deployedAt: new Date(),
    };
  }

  saveDeploymentConfig(results: DeploymentResult[]) {
    const config = {
      network: 'testnet',
      deployedAt: new Date().toISOString(),
      contracts: results.reduce((acc, result) => {
        acc[result.contractName] = {
          txid: result.txid,
          scriptHash: result.scriptHash,
          address: result.address,
          deployedAt: result.deployedAt.toISOString(),
        };
        return acc;
      }, {} as Record<string, any>),
    };

    const configPath = path.join(__dirname, '../config/contracts.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    console.log('\n💾 Deployment config saved to:', configPath);
  }
}

async function main() {
  console.log('🚀 BSV Voting System - Contract Deployment');
  console.log('==========================================\n');

  try {
    const deployer = new ContractDeployer();
    await deployer.initialize();

    // Deploy contracts
    const ballotId = 'test-ballot-' + Date.now();
    const merkleRoot = sha256(toByteString('voter-registry')).toString('hex');

    const results: DeploymentResult[] = [];

    results.push(await deployer.deployVoteTicket(ballotId));
    results.push(await deployer.deployVotingRegistry(merkleRoot, ballotId));

    deployer.saveDeploymentConfig(results);

    console.log('\n✅ All contracts deployed successfully!');
    console.log('\n📋 Deployment Summary:');
    results.forEach(r => {
      console.log(`\n  ${r.contractName}:`);
      console.log(`    TX ID: ${r.txid}`);
      console.log(`    Address: ${r.address}`);
      console.log(`    Script Hash: ${r.scriptHash}`);
    });

    console.log('\n🔗 View on Blockchain:');
    console.log('   https://test.whatsonchain.com/');

  } catch (error) {
    console.error('\n❌ Deployment failed:', error);
    process.exit(1);
  }
}

// Run deployment
if (require.main === module) {
  main().then(() => {
    console.log('\n✅ Deployment script completed');
    process.exit(0);
  }).catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
}

export { ContractDeployer };
