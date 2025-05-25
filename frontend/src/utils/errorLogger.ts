/**
 * Error logging utility for better debugging
 */

export interface ErrorLog {
  timestamp: Date;
  message: string;
  stack?: string;
  component?: string;
  props?: any;
  userAgent: string;
  url: string;
}

class ErrorLogger {
  private errors: ErrorLog[] = [];
  private maxErrors = 50; // Keep last 50 errors

  log(error: Error, component?: string, props?: any) {
    const errorLog: ErrorLog = {
      timestamp: new Date(),
      message: error.message,
      stack: error.stack,
      component,
      props,
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    this.errors.push(errorLog);
    
    // Keep only last maxErrors
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    // Log to console with styling
    console.group(`🚨 Error in ${component || 'Unknown Component'}`);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('Component:', component);
    console.error('Props:', props);
    console.error('URL:', window.location.href);
    console.groupEnd();

    // In development, show a toast notification
    if (import.meta.env.DEV) {
      this.showErrorToast(error.message);
    }

    // Here you could send to an error tracking service like Sentry
    // if (import.meta.env.PROD) {
    //   sendToErrorTracking(errorLog);
    // }
  }

  getErrors(): ErrorLog[] {
    return this.errors;
  }

  clearErrors() {
    this.errors = [];
  }

  private showErrorToast(message: string) {
    // Create a simple toast notification
    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.innerHTML = `
      <div style="
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #ef4444;
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 9999;
        max-width: 400px;
        animation: slideIn 0.3s ease-out;
      ">
        <div style="font-weight: bold; margin-bottom: 4px;">⚠️ Error Detected</div>
        <div style="font-size: 14px;">${message}</div>
      </div>
      <style>
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      </style>
    `;
    
    document.body.appendChild(toast);
    
    // Remove after 5 seconds
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 5000);
  }
}

// Create singleton instance
export const errorLogger = new ErrorLogger();

// Helper function to wrap async functions with error handling
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  componentName?: string
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      errorLogger.log(error as Error, componentName);
      throw error; // Re-throw to maintain original behavior
    }
  }) as T;
}

// React hook for error handling
export function useErrorHandler() {
  return (error: Error, errorInfo?: { componentStack?: string }) => {
    errorLogger.log(
      error,
      errorInfo?.componentStack ? 'React Component' : 'Unknown',
      { componentStack: errorInfo?.componentStack }
    );
  };
}