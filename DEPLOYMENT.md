# BSV Voting System - Deployment Guide

**Version**: 4.0.0  
**Status**: ✅ Production Ready  
**Last Updated**: 2025-11-20

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Microservices Overview](#microservices-overview)
3. [Local Development](#local-development)
4. [Docker Deployment](#docker-deployment)
5. [Kubernetes Deployment](#kubernetes-deployment)
6. [Smart Contract Deployment](#smart-contract-deployment)
7. [CI/CD Pipeline](#cicd-pipeline)
8. [Monitoring](#monitoring)

---

## 🔧 Prerequisites

### Required Tools

- **Node.js**: 20.x LTS
- **Docker**: 24.x or later
- **Kubernetes**: 1.28+ (kubectl configured)
- **GitHub Account**: For container registry (GHCR)
- **BSV Testnet**: Funded wallet for contract deployment

### Environment Setup

```bash
# Clone repository
git clone https://github.com/frogitzamna-wq/voting-system.git
cd voting-system

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/voting

# Redis
REDIS_URL=redis://localhost:6379

# BSV Network
BSV_NETWORK=testnet
BSV_PRIVATE_KEY=<your-wif-key>

# CORS
CORS_ORIGIN=*

# Node Environment
NODE_ENV=production
```

---

## 🏗️ Microservices Overview

| Service | Port | Purpose | Endpoints |
|---------|------|---------|-----------|
| **Vote API** | 3100 | Vote casting, voter registration, ZK proofs | POST /votes, POST /register, GET /votes/:id |
| **Ballot API** | 3101 | Election management, candidates | POST /ballots, GET /ballots, PUT /ballots/:id/status |
| **Verification API** | 3102 | Vote verification, tallying | POST /verify, GET /tally/:ballotId |
| **Explorer API** | 3103 | Public audit, blockchain queries | GET /audit/:ballotId, GET /stats |

---

## 💻 Local Development

### Run All Tests

```bash
npm test
```

### Start Microservices Locally

```bash
# Terminal 1: Vote API
npm run dev:vote-api

# Terminal 2: Ballot API
npm run dev:ballot-api

# Terminal 3: Verification API
npm run dev:verification-api

# Terminal 4: Explorer API
npm run dev:explorer-api
```

### Access APIs

- Vote API: http://localhost:3100
- Ballot API: http://localhost:3101
- Verification API: http://localhost:3102
- Explorer API: http://localhost:3103

---

## 🐳 Docker Deployment

### Build Docker Images

```bash
# Build all microservices
docker build -f microservices/vote-api/Dockerfile -t vote-api:latest .
docker build -f microservices/ballot-api/Dockerfile -t ballot-api:latest .
docker build -f microservices/verification-api/Dockerfile -t verification-api:latest .
docker build -f microservices/explorer-api/Dockerfile -t explorer-api:latest .
```

### Run with Docker Compose

```bash
# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Tag and Push to GHCR

```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Tag images
docker tag vote-api:latest ghcr.io/frogitzamna-wq/voting-system/vote-api:latest

# Push images
docker push ghcr.io/frogitzamna-wq/voting-system/vote-api:latest
```

---

## ☸️ Kubernetes Deployment

### Prerequisites

- Kubernetes cluster (GKE, EKS, AKS, or local minikube)
- kubectl configured
- NGINX Ingress Controller installed

### Deploy Infrastructure

```bash
# Create namespace and infrastructure
kubectl apply -f k8s/infrastructure.yaml

# Verify namespace
kubectl get namespace voting-system

# Check PostgreSQL and Redis
kubectl get pods -n voting-system
```

### Deploy Microservices

```bash
# Deploy all microservices
kubectl apply -f k8s/vote-api.yaml
kubectl apply -f k8s/microservices.yaml

# Check deployments
kubectl get deployments -n voting-system

# Check services
kubectl get services -n voting-system
```

### Configure Ingress

```bash
# Update ingress hosts in k8s/infrastructure.yaml
# Replace example.com with your domain

# Apply ingress
kubectl apply -f k8s/infrastructure.yaml

# Get ingress IP
kubectl get ingress -n voting-system
```

### Scale Deployments

```bash
# Scale vote-api to 5 replicas
kubectl scale deployment vote-api --replicas=5 -n voting-system

# Auto-scale based on CPU
kubectl autoscale deployment vote-api \
  --cpu-percent=70 \
  --min=3 \
  --max=10 \
  -n voting-system
```

### Update Deployment

```bash
# Rolling update
kubectl set image deployment/vote-api \
  vote-api=ghcr.io/frogitzamna-wq/voting-system/vote-api:v2.0.0 \
  -n voting-system

# Check rollout status
kubectl rollout status deployment/vote-api -n voting-system

# Rollback if needed
kubectl rollout undo deployment/vote-api -n voting-system
```

---

## 📜 Smart Contract Deployment

### Prepare Wallet

```bash
# Generate new wallet or use existing
export BSV_PRIVATE_KEY=<your-wif-key>

# Fund wallet at https://faucet.bsvtest.net/
```

### Deploy Contracts

```bash
# Run deployment script
npm run deploy:contracts

# Output:
# 🚀 BSV Voting System - Contract Deployment
# ==========================================
# 
# 💰 Wallet Balance: 0.5 BSV
# 
# 📜 Deploying VoteTicket Contract...
# ✅ VoteTicket deployed!
#    TX ID: abc123...
# 
# 📜 Deploying VotingRegistry Contract...
# ✅ VotingRegistry deployed!
#    TX ID: def456...
# 
# 💾 Deployment config saved to: config/contracts.json
```

### Verify Contracts

```bash
# View on block explorer
open https://test.whatsonchain.com/tx/<txid>
```

### Update Config

```bash
# Contract addresses saved to config/contracts.json
cat config/contracts.json
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

The pipeline runs automatically on push to `main`:

1. **Test**: Run all unit and integration tests
2. **Build**: Build Docker images for all microservices
3. **Push**: Push images to GitHub Container Registry
4. **Deploy**: Deploy to Kubernetes cluster

### Configure Secrets

Add to GitHub Repository Secrets:

```bash
KUBE_CONFIG          # Kubernetes config (base64 encoded)
BSV_PRIVATE_KEY      # Smart contract deployment key
DATABASE_PASSWORD    # Production database password
```

### Manual Trigger

```bash
# Trigger workflow via GitHub CLI
gh workflow run deploy.yaml
```

### Monitor Pipeline

```bash
# View workflow runs
gh run list

# View logs
gh run view <run-id> --log
```

---

## 📊 Monitoring

### Health Checks

```bash
# Check all service health
curl http://vote.example.com/api/v1/health
curl http://ballot.example.com/api/v1/health
curl http://verify.example.com/api/v1/health
curl http://explorer.example.com/api/v1/health
```

### Kubernetes Monitoring

```bash
# Pod status
kubectl get pods -n voting-system -w

# Resource usage
kubectl top pods -n voting-system

# Logs
kubectl logs -f deployment/vote-api -n voting-system

# Events
kubectl get events -n voting-system --sort-by='.lastTimestamp'
```

### Prometheus Metrics

```bash
# Install Prometheus (if not installed)
helm install prometheus prometheus-community/prometheus

# Expose metrics from services
# Add /metrics endpoint to each API
```

---

## 🔐 Security

### SSL/TLS

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create ClusterIssuer
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

### Update Secrets

```bash
# Update database password
kubectl create secret generic voting-secrets \
  --from-literal=database-url=postgresql://user:newpass@postgres:5432/voting \
  --namespace=voting-system \
  --dry-run=client -o yaml | kubectl apply -f -
```

---

## 🐛 Troubleshooting

### Pod Not Starting

```bash
# Describe pod
kubectl describe pod <pod-name> -n voting-system

# Check logs
kubectl logs <pod-name> -n voting-system
```

### Database Connection Issues

```bash
# Test PostgreSQL connection
kubectl run -it --rm psql-test \
  --image=postgres:16-alpine \
  --restart=Never \
  --namespace=voting-system \
  -- psql postgresql://user:pass@postgres:5432/voting
```

### Ingress Not Working

```bash
# Check ingress controller
kubectl get pods -n ingress-nginx

# Check ingress rules
kubectl describe ingress voting-ingress -n voting-system
```

---

## 📚 Additional Resources

- **BSV Documentation**: https://docs.bsvblockchain.org/
- **sCrypt Documentation**: https://docs.scrypt.io/
- **Kubernetes Documentation**: https://kubernetes.io/docs/
- **Docker Documentation**: https://docs.docker.com/

---

## 📞 Support

**Issues**: https://github.com/frogitzamna-wq/voting-system/issues  
**Discussions**: https://github.com/frogitzamna-wq/voting-system/discussions  
**License**: MIT

---

**Deployment Status**: ✅ Production Ready  
**Last Updated**: 2025-11-20  
**Version**: 4.0.0
