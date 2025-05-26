// API configuration utility
export const getApiBase = (): string => {
  // In production (when VITE_API_BASE is empty), use relative paths
  // This allows the frontend to work with the same domain as the API
  const apiBase = import.meta.env.VITE_API_BASE || '';
  
  // Remove trailing slash if present
  return apiBase.replace(/\/$/, '');
};

// Helper to build API URLs
export const buildApiUrl = (path: string): string => {
  const base = getApiBase();
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  return `${base}${normalizedPath}`;
};