import { useState, useEffect } from 'react';
import { errorLogger } from '../utils/errorLogger';

const DebugPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [errors, setErrors] = useState(errorLogger.getErrors());
  const [activeTab, setActiveTab] = useState<'errors' | 'info'>('errors');

  // Only show in development
  if (!import.meta.env.DEV) {
    return null;
  }

  useEffect(() => {
    // Update errors every second
    const interval = setInterval(() => {
      setErrors(errorLogger.getErrors());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const systemInfo = {
    mode: import.meta.env.MODE,
    baseUrl: import.meta.env.BASE_URL,
    apiUrl: import.meta.env.VITE_API_BASE || '(using relative paths)',
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth} × ${window.innerHeight}`,
    screen: `${window.screen.width} × ${window.screen.height}`,
    online: navigator.onLine,
    localStorage: (() => {
      try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
        return 'Available';
      } catch {
        return 'Unavailable';
      }
    })(),
  };

  return (
    <>
      {/* Debug Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 left-4 z-50 bg-gray-800 text-white px-3 py-2 rounded-lg shadow-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
        title="Debug Panel"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Debug
        {errors.length > 0 && (
          <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
            {errors.length}
          </span>
        )}
      </button>

      {/* Debug Panel */}
      {isOpen && (
        <div className="fixed bottom-16 left-4 z-50 bg-white rounded-lg shadow-2xl border border-gray-200 w-96 max-h-[600px] overflow-hidden">
          {/* Header */}
          <div className="bg-gray-800 text-white p-4 flex items-center justify-between">
            <h3 className="font-semibold">Debug Panel</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('errors')}
              className={`flex-1 px-4 py-2 text-sm font-medium ${
                activeTab === 'errors'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Errors ({errors.length})
            </button>
            <button
              onClick={() => setActiveTab('info')}
              className={`flex-1 px-4 py-2 text-sm font-medium ${
                activeTab === 'info'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              System Info
            </button>
          </div>

          {/* Content */}
          <div className="p-4 overflow-y-auto max-h-[400px]">
            {activeTab === 'errors' ? (
              <div className="space-y-3">
                {errors.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No errors logged</p>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        errorLogger.clearErrors();
                        setErrors([]);
                      }}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Clear all errors
                    </button>
                    {errors.map((error, index) => (
                      <div key={index} className="bg-red-50 border border-red-200 rounded p-3">
                        <div className="text-sm font-medium text-red-800">
                          {error.message}
                        </div>
                        <div className="text-xs text-red-600 mt-1">
                          {new Date(error.timestamp).toLocaleTimeString()}
                          {error.component && ` • ${error.component}`}
                        </div>
                        {error.stack && (
                          <details className="mt-2">
                            <summary className="text-xs text-red-700 cursor-pointer">
                              Stack trace
                            </summary>
                            <pre className="text-xs text-red-600 mt-1 overflow-x-auto">
                              {error.stack}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(systemInfo).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="font-medium text-gray-600">
                      {key.charAt(0).toUpperCase() + key.slice(1)}:
                    </span>
                    <span className="text-gray-800">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default DebugPanel;