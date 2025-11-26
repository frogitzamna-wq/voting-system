import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RegistrationPage } from './pages/RegistrationPage';
import { VotingPage } from './pages/VotingPage';
import { ReceiptPage } from './pages/ReceiptPage';
import { StatusPage } from './pages/StatusPage';
import { Layout } from './components/Layout';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/register" replace />} />
            <Route path="/register" element={<RegistrationPage />} />
            <Route path="/vote" element={<VotingPage />} />
            <Route path="/receipt" element={<ReceiptPage />} />
            <Route path="/status" element={<StatusPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
