process.env.NODE_ENV = 'test';
process.env.DB_STORAGE = ':memory:';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_key_123';
