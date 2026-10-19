const path = require('path');
const { getDatabaseConfig } = require('../src/config/database');

describe('Database Configuration Multi-Dialect', () => {
  it('detects postgresql from DATABASE_URL and configures SSL', () => {
    const config = getDatabaseConfig('postgresql://user:pass@ep-cool.us-east-2.aws.neon.tech/neondb?sslmode=require');
    expect(config.dialect).toBe('postgres');
    expect(config.dialectOptions).toEqual({
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    });
  });

  it('detects postgres from postgres:// URL prefix', () => {
    const config = getDatabaseConfig('postgres://user:pass@localhost:5432/testdb');
    expect(config.dialect).toBe('postgres');
    expect(config.dialectOptions.ssl).toEqual({
      require: true,
      rejectUnauthorized: false,
    });
  });

  it('falls back to sqlite in-memory for test environment', () => {
    const config = getDatabaseConfig(undefined, 'test');
    expect(config.dialect).toBe('sqlite');
    expect(config.storage).toBe(':memory:');
  });

  it('configures sqlite with custom storage path when provided', () => {
    const customPath = path.resolve(__dirname, 'test.sqlite');
    const config = getDatabaseConfig(undefined, 'development', customPath);
    expect(config.dialect).toBe('sqlite');
    expect(config.storage).toBe(customPath);
  });

  it('defaults to database.sqlite for non-test environment when no storage path provided', () => {
    const config = getDatabaseConfig(undefined, 'development');
    expect(config.dialect).toBe('sqlite');
    expect(config.storage).toMatch(/database\.sqlite$/);
  });
});
