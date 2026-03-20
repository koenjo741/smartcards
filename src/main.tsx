import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
// Register Service Worker for PWA (Disabled temporarily)
// import { registerSW } from 'virtual:pwa-register'
// registerSW({ immediate: true })

import { ErrorBoundary } from './components/ErrorBoundary.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallbackTitle="Application Error" fallbackMessage="A critical error occurred. Please try refreshing the page or clearing your data.">
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
