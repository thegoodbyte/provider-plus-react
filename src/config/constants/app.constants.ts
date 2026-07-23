/**
 * Application-wide Configuration Constants
 * Centralized configuration for general application settings
 */

// Port Configuration
export const PORTS = {
  FRONTEND: process.env.REACT_APP_FRONTEND_PORT || 3000,
  API: process.env.REACT_APP_API_PORT || 3005,
  CLIENT_WORKFLOW: process.env.REACT_APP_CLIENT_WORKFLOW_PORT || 3001,
  DEV_PORTS: [3000, 3001, 3002, 3003, 3005, 3006]
} as const;

// API Endpoints Configuration
export const API_ENDPOINTS = {
  PRODUCTION: 'https://api.ibogaspirit.net',
  RETREAT_ENGINE: 'https://api.retreatengine.com',
  RETREAT_ENGINE_DEV: 'https://api.dev.retreatengine.com',
  LOCAL: `http://localhost:${PORTS.API}`,

  // External APIs
  EXCHANGE_RATE: 'https://api.exchangerate-api.com/v4/latest/USD',
  EXCHANGE_RATE_BACKUP: 'https://api.fxratesapi.com/latest',
  OPENAI: 'https://api.openai.com/v1/responses',
  RESEND: 'https://api.resend.com/emails'
} as const;

// CORS Allowed Origins
export const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3005',
  'http://localhost:3006',
  'https://ibogaspirit.com',
  'https://www.ibogaspirit.com',
  'https://ibogaspirit.net',
  'https://www.ibogaspirit.net',
  'https://ibogaready.com',
  'https://www.ibogaready.com',
  'https://retreatengine.com',
  'https://www.retreatengine.com',
  'https://api.retreatengine.com',
  'https://api.dev.retreatengine.com'
] as const;

// Timeout Configuration (in milliseconds)
export const TIMEOUTS = {
  DEFAULT: 30000,
  LONG_RUNNING: 60000,
  SHORT: 5000,
  PAGE_LOAD: 10000,
  MODAL_WAIT: 5000,
  API_REQUEST: 30000,
  RETRY_DELAY: 1000,
  SESSION: 86400000, // 24 hours
  CACHE_TTL: 3600000 // 1 hour
} as const;

// Retry Configuration
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: TIMEOUTS.RETRY_DELAY,
  BACKOFF_MULTIPLIER: 2
} as const;

// File Upload Configuration
export const FILE_UPLOAD = {
  MAX_SIZE: 10485760, // 10MB in bytes
  MAX_SIZE_LARGE: 52428800, // 50MB in bytes
  ALLOWED_IMAGE_TYPES: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  ALLOWED_DOCUMENT_TYPES: ['.pdf', '.doc', '.docx', '.xls', '.xlsx'],
  ALLOWED_MEDICAL_TYPES: ['.pdf', '.jpg', '.jpeg', '.png'],
  CHUNK_SIZE: 1048576 // 1MB chunks for large file uploads
} as const;

// Pagination Configuration
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  MIN_PAGE_SIZE: 5,
  DEFAULT_PAGE: 1
} as const;

// Cache Configuration
export const CACHE = {
  TTL: {
    SHORT: 60000, // 1 minute
    MEDIUM: 300000, // 5 minutes
    LONG: 3600000, // 1 hour
    VERY_LONG: 86400000 // 24 hours
  },
  KEYS: {
    PREFIX: 'provider_plus',
    SEPARATOR: ':',
    VERSION: 'v1'
  }
} as const;

// Validation Patterns
export const VALIDATION_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\+?[\d\s-()]+$/,
  URL: /^https?:\/\/.+/,
  SLUG: /^[a-z0-9-]+$/,
  ALPHANUMERIC: /^[a-zA-Z0-9]+$/,
  NUMERIC: /^\d+$/,
  DECIMAL: /^\d+\.?\d*$/
} as const;

// Date Formats
export const DATE_FORMATS = {
  DISPLAY: 'MMM DD, YYYY',
  INPUT: 'YYYY-MM-DD',
  DATETIME: 'MMM DD, YYYY HH:mm',
  TIME: 'HH:mm',
  API: 'YYYY-MM-DDTHH:mm:ss.SSSZ'
} as const;

// Default Values
export const DEFAULTS = {
  CURRENCY: 'EUR',
  LANGUAGE: 'en',
  TIMEZONE: 'UTC',
  DATE_FORMAT: DATE_FORMATS.DISPLAY,
  EMPTY_TEXT: 'N/A',
  UNKNOWN_TEXT: 'Unknown',
  PENDING_TEXT: 'Pending'
} as const;

// Helper function to get API base URL based on environment
export const getApiBaseUrl = (): string => {
  const env = process.env.REACT_APP_ENV || process.env.NODE_ENV;

  switch (env) {
    case 'production':
      return API_ENDPOINTS.PRODUCTION;
    case 'retreat-engine':
      return API_ENDPOINTS.RETREAT_ENGINE;
    case 'retreat-engine-dev':
      return API_ENDPOINTS.RETREAT_ENGINE_DEV;
    case 'development':
    default:
      return API_ENDPOINTS.LOCAL;
  }
};

// Helper function to check if origin is allowed
export const isAllowedOrigin = (origin: string): boolean => {
  return ALLOWED_ORIGINS.includes(origin as any);
};

// Helper function to validate file type
export const isAllowedFileType = (fileName: string, category: 'image' | 'document' | 'medical' = 'document'): boolean => {
  const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));

  switch (category) {
    case 'image':
      return FILE_UPLOAD.ALLOWED_IMAGE_TYPES.includes(extension as any);
    case 'medical':
      return FILE_UPLOAD.ALLOWED_MEDICAL_TYPES.includes(extension as any);
    case 'document':
    default:
      return FILE_UPLOAD.ALLOWED_DOCUMENT_TYPES.includes(extension as any);
  }
};

// Helper function to format file size
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};