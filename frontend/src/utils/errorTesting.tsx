/**
 * Error testing utilities for development
 * This helps test error handling without breaking the app
 */

import { useState } from 'react';

export const ErrorTestingPanel = () => {
  const [showPanel, setShowPanel] = useState(false);

  // Only show in development
  if (!import.meta.env.DEV) {
    return null;
  }

  const testErrors = {
    throwError: () => {
      throw new Error('Test error: This is a synchronous error');
    },
    
    throwAsyncError: async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      throw new Error('Test error: This is an async error');
    },
    
    unhandledPromise: () => {
      Promise.reject('Test error: Unhandled promise rejection');
    },
    
    networkError: async () => {
      await fetch('http://localhost:9999/nonexistent');
    },
    
    importError: () => {
      throw new Error('Test error: Simulated import error');
    },
    
    typeError: () => {
      // @ts-ignore
      const obj = null;
      obj.someMethod();
    },
    
    referenceError: () => {
      // @ts-ignore
      console.log(nonExistentVariable);
    }
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="fixed top-20 right-4 z-50 bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
      >
        🧪 Test Errors
      </button>

      {/* Error Testing Panel */}
      {showPanel && (
        <div className="fixed top-32 right-4 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-80">
          <h3 className="font-semibold mb-3">Error Testing (Dev Only)</h3>
          <div className="space-y-2">
            {Object.entries(testErrors).map(([name, handler]) => (
              <button
                key={name}
                onClick={() => {
                  try {
                    handler();
                  } catch (error) {
                    console.error('Test error caught:', error);
                  }
                }}
                className="w-full text-left px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm"
              >
                {name.replace(/([A-Z])/g, ' $1').trim()}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Click buttons to test error handling. Check console and debug panel.
          </p>
        </div>
      )}
    </>
  );
};