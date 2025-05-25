/**
 * Global error handlers to catch unhandled errors
 */

import { errorLogger } from './errorLogger';

export function setupGlobalErrorHandlers() {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('🚨 Unhandled Promise Rejection:', event.reason);
    errorLogger.log(
      new Error(`Unhandled Promise Rejection: ${event.reason}`),
      'Global',
      { promise: event.promise }
    );
    
    // Prevent the default browser behavior
    event.preventDefault();
  });

  // Handle global errors
  window.addEventListener('error', (event) => {
    console.error('🚨 Global Error:', event.error);
    errorLogger.log(
      event.error || new Error(event.message),
      'Global',
      {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      }
    );
    
    // Prevent the default browser behavior in development
    if (import.meta.env.DEV) {
      event.preventDefault();
    }
  });

  // Log when the app starts
  console.log('✅ Global error handlers initialized');
  
  // Log browser and environment info
  console.log('📱 Environment:', {
    mode: import.meta.env.MODE,
    userAgent: navigator.userAgent,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    },
    screen: {
      width: window.screen.width,
      height: window.screen.height
    }
  });
}

// Check for common issues
export function checkCommonIssues() {
  const issues: string[] = [];
  
  // Check if localStorage is available
  try {
    localStorage.setItem('test', 'test');
    localStorage.removeItem('test');
  } catch (e) {
    issues.push('LocalStorage is not available (private browsing mode?)');
  }
  
  // Check if cookies are enabled
  if (!navigator.cookieEnabled) {
    issues.push('Cookies are disabled');
  }
  
  // Check for required browser features
  const requiredFeatures = [
    { name: 'Promise', check: () => typeof Promise !== 'undefined' },
    { name: 'fetch', check: () => typeof fetch !== 'undefined' },
    { name: 'localStorage', check: () => typeof localStorage !== 'undefined' },
    { name: 'sessionStorage', check: () => typeof sessionStorage !== 'undefined' }
  ];
  
  requiredFeatures.forEach(feature => {
    if (!feature.check()) {
      issues.push(`${feature.name} is not supported`);
    }
  });
  
  // Log any issues found
  if (issues.length > 0) {
    console.warn('⚠️ Potential issues detected:', issues);
  }
  
  return issues;
}