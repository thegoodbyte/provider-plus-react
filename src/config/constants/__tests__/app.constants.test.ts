import {
  PORTS,
  API_ENDPOINTS,
  ALLOWED_ORIGINS,
  TIMEOUTS,
  RETRY_CONFIG,
  FILE_UPLOAD,
  PAGINATION,
  CACHE,
  VALIDATION_PATTERNS,
  DATE_FORMATS,
  DEFAULTS,
  getApiBaseUrl,
  isAllowedOrigin,
  isAllowedFileType,
  formatFileSize
} from '../app.constants';

// Mock environment variables
const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = originalEnv;
});

describe('App Constants', () => {
  describe('Port Configuration', () => {
    it('should have correct default ports', () => {
      expect(PORTS.FRONTEND).toBe(3000);
      expect(PORTS.API).toBe(3005);
      expect(PORTS.CLIENT_WORKFLOW).toBe(3001);
      expect(PORTS.DEV_PORTS).toEqual([3000, 3001, 3002, 3003, 3005, 3006]);
    });

    it('should use environment variables when available', () => {
      process.env.REACT_APP_FRONTEND_PORT = '4000';
      process.env.REACT_APP_API_PORT = '4005';

      // Re-import to get new values
      jest.resetModules();
      const { PORTS: NEW_PORTS } = require('../app.constants');

      expect(NEW_PORTS.FRONTEND).toBe('4000');
      expect(NEW_PORTS.API).toBe('4005');
    });
  });

  describe('API Endpoints', () => {
    it('should have all required API endpoints', () => {
      expect(API_ENDPOINTS.PRODUCTION).toBe('https://api.ibogaspirit.net');
      expect(API_ENDPOINTS.RETREAT_ENGINE).toBe('https://api.retreatengine.com');
      expect(API_ENDPOINTS.LOCAL).toContain('http://localhost:');
      expect(API_ENDPOINTS.EXCHANGE_RATE).toContain('exchangerate-api.com');
      expect(API_ENDPOINTS.OPENAI).toContain('openai.com');
    });
  });

  describe('CORS Origins', () => {
    it('should include all development ports', () => {
      expect(ALLOWED_ORIGINS).toContain('http://localhost:3000');
      expect(ALLOWED_ORIGINS).toContain('http://localhost:3005');
    });

    it('should include all production domains', () => {
      expect(ALLOWED_ORIGINS).toContain('https://ibogaspirit.com');
      expect(ALLOWED_ORIGINS).toContain('https://ibogaready.com');
      expect(ALLOWED_ORIGINS).toContain('https://retreatengine.com');
    });

    it('should validate origins correctly', () => {
      expect(isAllowedOrigin('http://localhost:3000')).toBe(true);
      expect(isAllowedOrigin('https://ibogaspirit.com')).toBe(true);
      expect(isAllowedOrigin('http://malicious.com')).toBe(false);
      expect(isAllowedOrigin('')).toBe(false);
    });
  });

  describe('Timeout Configuration', () => {
    it('should have appropriate timeout values', () => {
      expect(TIMEOUTS.DEFAULT).toBe(30000);
      expect(TIMEOUTS.SHORT).toBe(5000);
      expect(TIMEOUTS.LONG_RUNNING).toBe(60000);
      expect(TIMEOUTS.SESSION).toBe(86400000); // 24 hours
      expect(TIMEOUTS.CACHE_TTL).toBe(3600000); // 1 hour
    });

    it('should have consistent retry configuration', () => {
      expect(RETRY_CONFIG.MAX_RETRIES).toBe(3);
      expect(RETRY_CONFIG.RETRY_DELAY).toBe(TIMEOUTS.RETRY_DELAY);
      expect(RETRY_CONFIG.BACKOFF_MULTIPLIER).toBe(2);
    });
  });

  describe('File Upload Configuration', () => {
    it('should have correct file size limits', () => {
      expect(FILE_UPLOAD.MAX_SIZE).toBe(10485760); // 10MB
      expect(FILE_UPLOAD.MAX_SIZE_LARGE).toBe(52428800); // 50MB
      expect(FILE_UPLOAD.CHUNK_SIZE).toBe(1048576); // 1MB
    });

    it('should validate file types correctly', () => {
      expect(isAllowedFileType('test.jpg', 'image')).toBe(true);
      expect(isAllowedFileType('test.pdf', 'document')).toBe(true);
      expect(isAllowedFileType('test.pdf', 'medical')).toBe(true);
      expect(isAllowedFileType('test.exe', 'document')).toBe(false);
      expect(isAllowedFileType('test.gif', 'medical')).toBe(false);
    });

    it('should handle case-insensitive file extensions', () => {
      expect(isAllowedFileType('test.JPG', 'image')).toBe(true);
      expect(isAllowedFileType('test.PDF', 'document')).toBe(true);
    });
  });

  describe('Pagination Configuration', () => {
    it('should have sensible pagination defaults', () => {
      expect(PAGINATION.DEFAULT_PAGE_SIZE).toBe(20);
      expect(PAGINATION.MAX_PAGE_SIZE).toBe(100);
      expect(PAGINATION.MIN_PAGE_SIZE).toBe(5);
      expect(PAGINATION.DEFAULT_PAGE).toBe(1);
    });

    it('should ensure max is greater than default', () => {
      expect(PAGINATION.MAX_PAGE_SIZE).toBeGreaterThan(PAGINATION.DEFAULT_PAGE_SIZE);
    });
  });

  describe('Cache Configuration', () => {
    it('should have progressive TTL values', () => {
      expect(CACHE.TTL.SHORT).toBeLessThan(CACHE.TTL.MEDIUM);
      expect(CACHE.TTL.MEDIUM).toBeLessThan(CACHE.TTL.LONG);
      expect(CACHE.TTL.LONG).toBeLessThan(CACHE.TTL.VERY_LONG);
    });

    it('should have consistent cache key structure', () => {
      expect(CACHE.KEYS.PREFIX).toBe('provider_plus');
      expect(CACHE.KEYS.SEPARATOR).toBe(':');
      expect(CACHE.KEYS.VERSION).toBe('v1');
    });
  });

  describe('Validation Patterns', () => {
    it('should validate emails correctly', () => {
      expect(VALIDATION_PATTERNS.EMAIL.test('test@example.com')).toBe(true);
      expect(VALIDATION_PATTERNS.EMAIL.test('invalid.email')).toBe(false);
      expect(VALIDATION_PATTERNS.EMAIL.test('test@')).toBe(false);
    });

    it('should validate phone numbers correctly', () => {
      expect(VALIDATION_PATTERNS.PHONE.test('+1234567890')).toBe(true);
      expect(VALIDATION_PATTERNS.PHONE.test('123-456-7890')).toBe(true);
      expect(VALIDATION_PATTERNS.PHONE.test('(123) 456-7890')).toBe(true);
      expect(VALIDATION_PATTERNS.PHONE.test('abc123')).toBe(false);
    });

    it('should validate URLs correctly', () => {
      expect(VALIDATION_PATTERNS.URL.test('https://example.com')).toBe(true);
      expect(VALIDATION_PATTERNS.URL.test('http://localhost:3000')).toBe(true);
      expect(VALIDATION_PATTERNS.URL.test('ftp://example.com')).toBe(false);
      expect(VALIDATION_PATTERNS.URL.test('not-a-url')).toBe(false);
    });

    it('should validate numeric patterns correctly', () => {
      expect(VALIDATION_PATTERNS.NUMERIC.test('12345')).toBe(true);
      expect(VALIDATION_PATTERNS.NUMERIC.test('abc')).toBe(false);
      expect(VALIDATION_PATTERNS.DECIMAL.test('123.45')).toBe(true);
      expect(VALIDATION_PATTERNS.DECIMAL.test('123')).toBe(true);
    });
  });

  describe('Helper Functions', () => {
    describe('getApiBaseUrl', () => {
      it('should return production URL in production', () => {
        process.env.REACT_APP_ENV = 'production';
        expect(getApiBaseUrl()).toBe(API_ENDPOINTS.PRODUCTION);
      });

      it('should return local URL in development', () => {
        process.env.REACT_APP_ENV = 'development';
        expect(getApiBaseUrl()).toContain('http://localhost');
      });

      it('should return retreat engine URL when specified', () => {
        process.env.REACT_APP_ENV = 'retreat-engine';
        expect(getApiBaseUrl()).toBe(API_ENDPOINTS.RETREAT_ENGINE);
      });

      it('should default to local URL when no env is set', () => {
        process.env.REACT_APP_ENV = undefined;
        process.env.NODE_ENV = undefined;
        expect(getApiBaseUrl()).toBe(API_ENDPOINTS.LOCAL);
      });
    });

    describe('formatFileSize', () => {
      it('should format bytes correctly', () => {
        expect(formatFileSize(0)).toBe('0 Bytes');
        expect(formatFileSize(1024)).toBe('1 KB');
        expect(formatFileSize(1048576)).toBe('1 MB');
        expect(formatFileSize(1073741824)).toBe('1 GB');
      });

      it('should handle decimal values', () => {
        expect(formatFileSize(1536)).toBe('1.5 KB');
        expect(formatFileSize(1572864)).toBe('1.5 MB');
      });
    });
  });

  describe('Default Values', () => {
    it('should have appropriate defaults', () => {
      expect(DEFAULTS.CURRENCY).toBe('EUR');
      expect(DEFAULTS.LANGUAGE).toBe('en');
      expect(DEFAULTS.TIMEZONE).toBe('UTC');
      expect(DEFAULTS.EMPTY_TEXT).toBe('N/A');
    });
  });
});