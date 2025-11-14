-- BSV Voting System Database Schema
-- PostgreSQL 14+

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Ballots (Elections)
CREATE TABLE ballots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  merkle_root BYTEA NOT NULL,
  contract_txid VARCHAR(64),
  contract_address VARCHAR(255),
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  candidate_count INTEGER NOT NULL DEFAULT 0,
  total_votes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(255),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'active', 'closed', 'finalized'))
);

-- Candidates
CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ballot_id UUID NOT NULL REFERENCES ballots(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  candidate_index INTEGER NOT NULL,
  vote_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(ballot_id, candidate_index),
  CONSTRAINT valid_index CHECK (candidate_index >= 0)
);

-- Votes (on-chain references)
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ballot_id UUID NOT NULL REFERENCES ballots(id) ON DELETE CASCADE,
  txid VARCHAR(64) UNIQUE NOT NULL,
  nullifier_hash BYTEA NOT NULL UNIQUE,
  vote_commitment BYTEA NOT NULL,
  zk_proof JSONB NOT NULL,
  candidate_index INTEGER,
  block_height INTEGER,
  block_hash VARCHAR(64),
  confirmed BOOLEAN DEFAULT FALSE,
  confirmation_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_candidate CHECK (candidate_index >= 0)
);

-- Nullifiers (prevent double voting)
CREATE TABLE nullifiers (
  nullifier_hash BYTEA PRIMARY KEY,
  ballot_id UUID NOT NULL REFERENCES ballots(id) ON DELETE CASCADE,
  vote_id UUID REFERENCES votes(id),
  used_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(ballot_id, nullifier_hash)
);

-- Voter Registry (off-chain voter list for Merkle tree construction)
CREATE TABLE voters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ballot_id UUID NOT NULL REFERENCES ballots(id) ON DELETE CASCADE,
  voter_commitment BYTEA NOT NULL,
  merkle_index INTEGER NOT NULL,
  credential_hash BYTEA NOT NULL,
  registered_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(ballot_id, merkle_index),
  UNIQUE(ballot_id, voter_commitment)
);

-- Audit Log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ballot_id UUID REFERENCES ballots(id),
  action VARCHAR(50) NOT NULL,
  actor VARCHAR(255),
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ZK Proof Verification Cache
CREATE TABLE zk_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proof_hash BYTEA NOT NULL UNIQUE,
  public_inputs JSONB NOT NULL,
  is_valid BOOLEAN NOT NULL,
  verified_at TIMESTAMP DEFAULT NOW(),
  verification_time_ms INTEGER
);

-- Indexes for performance
CREATE INDEX idx_ballots_status ON ballots(status);
CREATE INDEX idx_ballots_start_time ON ballots(start_time);
CREATE INDEX idx_ballots_end_time ON ballots(end_time);
CREATE INDEX idx_ballots_contract_txid ON ballots(contract_txid);

CREATE INDEX idx_candidates_ballot_id ON candidates(ballot_id);
CREATE INDEX idx_candidates_index ON candidates(ballot_id, candidate_index);

CREATE INDEX idx_votes_ballot_id ON votes(ballot_id);
CREATE INDEX idx_votes_txid ON votes(txid);
CREATE INDEX idx_votes_nullifier ON votes(nullifier_hash);
CREATE INDEX idx_votes_confirmed ON votes(confirmed);
CREATE INDEX idx_votes_created_at ON votes(created_at);

CREATE INDEX idx_nullifiers_ballot_id ON nullifiers(ballot_id);
CREATE INDEX idx_nullifiers_used_at ON nullifiers(used_at);

CREATE INDEX idx_voters_ballot_id ON voters(ballot_id);
CREATE INDEX idx_voters_commitment ON voters(voter_commitment);

CREATE INDEX idx_audit_log_ballot_id ON audit_log(ballot_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

CREATE INDEX idx_zk_verifications_hash ON zk_verifications(proof_hash);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ballots_updated_at
  BEFORE UPDATE ON ballots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Views for analytics
CREATE VIEW ballot_stats AS
SELECT 
  b.id,
  b.title,
  b.status,
  b.start_time,
  b.end_time,
  COUNT(DISTINCT v.id) as total_votes,
  COUNT(DISTINCT v.id) FILTER (WHERE v.confirmed) as confirmed_votes,
  COUNT(DISTINCT c.id) as candidate_count,
  b.created_at
FROM ballots b
LEFT JOIN votes v ON b.id = v.ballot_id
LEFT JOIN candidates c ON b.id = c.ballot_id
GROUP BY b.id;

CREATE VIEW candidate_results AS
SELECT 
  c.id,
  c.ballot_id,
  c.name,
  c.candidate_index,
  COUNT(v.id) as vote_count,
  COUNT(v.id) FILTER (WHERE v.confirmed) as confirmed_vote_count,
  b.total_votes,
  CASE 
    WHEN b.total_votes > 0 
    THEN ROUND((COUNT(v.id)::DECIMAL / b.total_votes) * 100, 2)
    ELSE 0
  END as vote_percentage
FROM candidates c
LEFT JOIN votes v ON c.ballot_id = v.ballot_id AND c.candidate_index = v.candidate_index
LEFT JOIN ballots b ON c.ballot_id = b.id
GROUP BY c.id, c.ballot_id, c.name, c.candidate_index, b.total_votes;

-- Comments
COMMENT ON TABLE ballots IS 'Elections/ballots with contract references';
COMMENT ON TABLE candidates IS 'Candidates/options in each ballot';
COMMENT ON TABLE votes IS 'Vote transactions recorded on BSV blockchain';
COMMENT ON TABLE nullifiers IS 'Used nullifiers to prevent double voting';
COMMENT ON TABLE voters IS 'Eligible voter registry for Merkle tree';
COMMENT ON TABLE audit_log IS 'Complete audit trail of all actions';
COMMENT ON TABLE zk_verifications IS 'Cache of verified ZK proofs';
