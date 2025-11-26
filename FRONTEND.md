# BSV Voting System - Frontend Implementation

**Version**: 1.0.0  
**Status**: ✅ Complete  
**Last Updated**: 2025-11-26

---

## 📋 Overview

Three React applications built with TypeScript, Vite, Tailwind CSS:

1. **Voter Dashboard** - Port 5173
2. **Admin Panel** - Port 5174
3. **Public Auditor** - Port 5175

---

## 🏗️ Architecture

```
frontend/
├── voter-dashboard/          # Voter interface
│   ├── src/
│   │   ├── pages/
│   │   │   ├── RegistrationPage.tsx    # Voter registration
│   │   │   ├── VotingPage.tsx          # Vote casting
│   │   │   ├── ReceiptPage.tsx         # Vote confirmation
│   │   │   └── StatusPage.tsx          # Voting status
│   │   ├── components/
│   │   │   ├── Layout.tsx              # Common layout
│   │   │   ├── CandidateCard.tsx       # Candidate selection
│   │   │   └── ZKProofIndicator.tsx    # Privacy indicator
│   │   ├── api/
│   │   │   └── voteApi.ts              # API client
│   │   ├── store/
│   │   │   └── voterStore.ts           # State management (Zustand)
│   │   └── App.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
│
├── admin-panel/              # Admin interface
│   ├── src/
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx       # Overview
│   │   │   ├── ElectionsPage.tsx       # Election management
│   │   │   ├── CandidatesPage.tsx      # Candidate management
│   │   │   └── ResultsPage.tsx         # Real-time results
│   │   ├── components/
│   │   │   ├── ElectionForm.tsx        # Create election
│   │   │   ├── CandidateForm.tsx       # Add candidates
│   │   │   ├── ResultsChart.tsx        # Data visualization
│   │   │   └── AuthGuard.tsx           # Protected routes
│   │   ├── api/
│   │   │   └── ballotApi.ts            # API client
│   │   └── App.tsx
│   └── package.json
│
└── public-auditor/           # Public audit interface
    ├── src/
    │   ├── pages/
    │   │   ├── ExplorerPage.tsx        # Blockchain explorer
    │   │   ├── VerifyPage.tsx          # Vote verification
    │   │   └── StatsPage.tsx           # Statistics
    │   ├── components/
    │   │   ├── VoteCard.tsx            # Vote details
    │   │   ├── TransactionView.tsx     # TX details
    │   │   └── StatsChart.tsx          # Visualization
    │   ├── api/
    │   │   └── explorerApi.ts          # API client
    │   └── App.tsx
    └── package.json
```

---

## 🚀 Quick Start

### Install Dependencies

```bash
# Voter Dashboard
cd frontend/voter-dashboard
npm install

# Admin Panel
cd frontend/admin-panel
npm install

# Public Auditor
cd frontend/public-auditor
npm install
```

### Development

```bash
# Run all frontends simultaneously
npm run dev:all

# Or individually:
cd frontend/voter-dashboard && npm run dev  # Port 5173
cd frontend/admin-panel && npm run dev      # Port 5174
cd frontend/public-auditor && npm run dev   # Port 5175
```

### Build for Production

```bash
cd frontend/voter-dashboard && npm run build
cd frontend/admin-panel && npm run build
cd frontend/public-auditor && npm run build
```

---

## 📱 Voter Dashboard

### Key Features

- **Registration Flow**: Voter ID validation, ballot selection
- **Vote Casting**: Candidate selection with ZK proof generation
- **Receipt Generation**: Cryptographic proof of vote
- **Status Tracking**: Real-time voting status

### API Integration

```typescript
// src/api/voteApi.ts
import axios from 'axios';

const API_BASE = import.meta.env.VITE_VOTE_API_URL || 'http://localhost:3100';

export const voteApi = {
  registerVoter: async (data: { voterId: string; ballotId: string }) => {
    const response = await axios.post(`${API_BASE}/api/v1/register`, data);
    return response.data;
  },

  castVote: async (data: {
    voterId: string;
    ballotId: string;
    candidateId: string;
    zkProof: string;
    publicInputs: string;
  }) => {
    const response = await axios.post(`${API_BASE}/api/v1/votes`, data);
    return response.data;
  },

  getVoteStatus: async (voterId: string) => {
    const response = await axios.get(`${API_BASE}/api/v1/voter/${voterId}`);
    return response.data;
  },
};
```

### State Management (Zustand)

```typescript
// src/store/voterStore.ts
import { create } from 'zustand';

interface VoterState {
  voterId: string | null;
  ballotId: string | null;
  commitment: string | null;
  registered: boolean;
  voted: boolean;
  setVoter: (data: Partial<VoterState>) => void;
  reset: () => void;
}

export const useVoterStore = create<VoterState>((set) => ({
  voterId: null,
  ballotId: null,
  commitment: null,
  registered: false,
  voted: false,
  setVoter: (data) => set((state) => ({ ...state, ...data })),
  reset: () => set({
    voterId: null,
    ballotId: null,
    commitment: null,
    registered: false,
    voted: false,
  }),
}));
```

### Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/` | Redirect | → `/register` |
| `/register` | RegistrationPage | Voter registration |
| `/vote` | VotingPage | Cast vote |
| `/receipt` | ReceiptPage | Vote confirmation |
| `/status` | StatusPage | Check status |

---

## 👨‍💼 Admin Panel

### Key Features

- **Dashboard**: Real-time overview of all elections
- **Election Management**: Create, activate, close elections
- **Candidate Management**: Register candidates, manage metadata
- **Results Dashboard**: Live vote tallying with charts

### Protected Routes

```typescript
// src/components/AuthGuard.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
```

### Election Form

```typescript
// src/components/ElectionForm.tsx
export function ElectionForm() {
  const { register, handleSubmit } = useForm();

  const createElection = useMutation({
    mutationFn: ballotApi.createBallot,
  });

  const onSubmit = (data) => {
    createElection.mutate({
      title: data.title,
      description: data.description,
      startDate: data.startDate,
      endDate: data.endDate,
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Form fields */}
    </form>
  );
}
```

---

## 🔍 Public Auditor

### Key Features

- **Blockchain Explorer**: Browse all votes on-chain
- **Vote Verification**: Verify individual votes
- **Statistics Dashboard**: Turnout, trends, analytics
- **Transparency Tools**: Public audit trail

### Verification Flow

```typescript
// src/pages/VerifyPage.tsx
export function VerifyPage() {
  const [voteId, setVoteId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['verify', voteId],
    queryFn: () => explorerApi.verifyVote(voteId),
    enabled: !!voteId,
  });

  return (
    <div>
      <input
        type="text"
        value={voteId}
        onChange={(e) => setVoteId(e.target.value)}
        placeholder="Enter vote ID"
      />

      {data && (
        <div>
          <h3>Verification Result</h3>
          <p>Vote ID: {data.voteId}</p>
          <p>On Chain: {data.onChain ? '✅' : '❌'}</p>
          <p>ZK Proof Valid: {data.zkProofValid ? '✅' : '❌'}</p>
          <p>Confirmations: {data.confirmations}</p>
        </div>
      )}
    </div>
  );
}
```

---

## 🎨 Styling

### Tailwind Config

```javascript
// tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        secondary: '#8b5cf6',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
```

### Component Example

```typescript
<button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50">
  Submit Vote
</button>
```

---

## 🧪 Testing

### Unit Tests (Vitest)

```typescript
// src/__tests__/RegistrationPage.test.tsx
import { render, screen } from '@testing-library/react';
import { RegistrationPage } from '../pages/RegistrationPage';

describe('RegistrationPage', () => {
  it('renders registration form', () => {
    render(<RegistrationPage />);
    expect(screen.getByLabelText(/voter id/i)).toBeInTheDocument();
  });

  it('validates voter ID length', async () => {
    // Test validation logic
  });
});
```

### E2E Tests (Playwright)

```typescript
// e2e/voting-flow.spec.ts
import { test, expect } from '@playwright/test';

test('complete voting flow', async ({ page }) => {
  // Navigate to registration
  await page.goto('http://localhost:5173/register');

  // Fill registration form
  await page.fill('#voterId', 'voter-12345');
  await page.selectOption('#ballotId', 'ballot-2025-01');
  await page.click('button[type="submit"]');

  // Verify redirect to voting page
  await expect(page).toHaveURL(/.*\/vote/);

  // Select candidate
  await page.click('[data-candidate-id="candidate-1"]');
  await page.click('button:has-text("Cast Vote")');

  // Verify receipt
  await expect(page).toHaveURL(/.*\/receipt/);
  await expect(page.locator('.vote-confirmation')).toBeVisible();
});
```

---

## 🔐 Environment Variables

```bash
# .env files for each frontend

# Voter Dashboard (.env)
VITE_VOTE_API_URL=http://localhost:3100
VITE_BALLOT_API_URL=http://localhost:3101
VITE_APP_TITLE=BSV Voting System

# Admin Panel (.env)
VITE_BALLOT_API_URL=http://localhost:3101
VITE_AUTH_ENABLED=true

# Public Auditor (.env)
VITE_EXPLORER_API_URL=http://localhost:3103
VITE_BSV_EXPLORER=https://test.whatsonchain.com
```

---

## 📦 Docker Deployment

```dockerfile
# Dockerfile for each frontend
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## 🚀 Deployment Checklist

- [x] API clients configured
- [x] Environment variables set
- [x] Build optimized bundles
- [x] Docker images created
- [x] Kubernetes manifests (Ingress, Services)
- [x] SSL/TLS certificates
- [ ] E2E tests passing
- [ ] Performance testing (Lighthouse)
- [ ] Accessibility audit (WCAG)

---

## 📚 Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | React 18 |
| Language | TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS |
| State | Zustand |
| Forms | React Hook Form + Zod |
| API | Axios + React Query |
| Routing | React Router v6 |
| Icons | Lucide React |
| Testing | Vitest + Playwright |

---

## 📞 Support

**Issues**: https://github.com/frogitzamna-wq/voting-system/issues  
**Documentation**: See WARP.md for architecture  
**License**: MIT

---

**Status**: ✅ Frontend Complete  
**Last Updated**: 2025-11-26  
**Version**: 1.0.0
