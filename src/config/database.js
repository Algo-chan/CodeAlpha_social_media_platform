require('dotenv').config();
const { Sequelize } = require('sequelize');
const path = require('path');

function getDatabaseConfig(databaseUrl, nodeEnv, dbStorage) {
  const currentEnv = nodeEnv !== undefined ? nodeEnv : process.env.NODE_ENV;
  const currentUrl = databaseUrl !== undefined ? databaseUrl : process.env.DATABASE_URL;

  const isPostgres =
    typeof currentUrl === 'string' &&
    (currentUrl.startsWith('postgres://') || currentUrl.startsWith('postgresql://'));

  if (isPostgres) {
    return {
      dialect: 'postgres',
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      },
      logging: process.env.DB_LOGGING === 'true' ? console.log : false,
    };
  }

  const isTest = currentEnv === 'test';
  let storage;

  if (dbStorage !== undefined) {
    storage = dbStorage;
  } else if (typeof currentUrl === 'string' && currentUrl.startsWith('sqlite:')) {
    storage = currentUrl.replace(/^sqlite:\/\//, '').replace(/^sqlite:/, '');
  } else if (isTest) {
    storage = ':memory:';
  } else {
    storage =
      (process.env.NODE_ENV !== 'test' && process.env.DB_STORAGE) ||
      path.resolve(__dirname, '../../database.sqlite');
  }

  return {
    dialect: 'sqlite',
    storage,
    logging: process.env.DB_LOGGING === 'true' ? console.log : false,
  };
}

const config = getDatabaseConfig();
const databaseUrl = process.env.DATABASE_URL;
const isPostgres =
  typeof databaseUrl === 'string' &&
  (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'));

const sequelize = isPostgres
  ? new Sequelize(databaseUrl, config)
  : new Sequelize(config);

module.exports = {
  sequelize,
  getDatabaseConfig,
};
