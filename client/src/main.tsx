import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';

import './index.css';
import App from './App.tsx';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { queryClient } from '@/lib/queryClient';
import { ToastProvider } from '@/components/ui/Toast';
import { WorkspaceThemeBridge } from '@/components/shell/WorkspaceThemeBridge';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <WorkspaceThemeBridge>
              <ToastProvider>
                <App />
              </ToastProvider>
            </WorkspaceThemeBridge>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
