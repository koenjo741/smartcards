import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
// Active unregistration of old service workers to release cache-locks
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister().then((success) => {
        if (success) {
          console.log('Unregistered stale service worker successfully.');
          window.location.reload();
        }
      });
    }
  });
}

import { ErrorBoundary } from './components/ErrorBoundary.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallbackTitle="Application Error" fallbackMessage="A critical error occurred. Please try refreshing the page or clearing your data.">
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
