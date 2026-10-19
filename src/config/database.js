require('dotenv').config();
const { Sequelize } = require('sequelize');
const path = require('path');

const isTest = process.env.NODE_ENV === 'test';
const defaultStorage = isTest
  ? ':memory:'
  : path.resolve(__dirname, '../../database.sqlite');

const storage = process.env.DB_STORAGE || defaultStorage;

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage,
  logging: process.env.DB_LOGGING === 'true' ? console.log : false,
});

module.exports = {
  sequelize,
};
