import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { setupGlobalErrorHandlers, checkCommonIssues } from './utils/globalErrorHandler'

// Setup global error handlers before anything else
setupGlobalErrorHandlers()

// Check for common issues
const issues = checkCommonIssues()
if (issues.length > 0) {
  console.warn('🚨 CashBFF detected potential issues:', issues)
}

const rootElement = document.getElementById('root')
console.log('Main.tsx - Root element:', rootElement)

if (rootElement) {
  console.log('Rendering App...')
  
  // Wrap the app with ErrorBoundary to catch any errors
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  )
} else {
  console.error('Root element not found!')
  // Show error in the DOM if root element is missing
  document.body.innerHTML = `
    <div style="padding: 20px; background: #fee; border: 1px solid #fcc; margin: 20px;">
      <h1>Critical Error: Root element not found!</h1>
      <p>The application cannot start because the root element is missing.</p>
      <p>Please check that index.html contains a div with id="root"</p>
    </div>
  `
}