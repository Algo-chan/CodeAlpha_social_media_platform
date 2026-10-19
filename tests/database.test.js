const { sequelize } = require('../src/config/database');

describe('Database Connection', () => {
  afterAll(async () => {
    await sequelize.close();
  });

  it('authenticates SQLite in-memory or file database', async () => {
    await expect(sequelize.authenticate()).resolves.not.toThrow();
  });
});
