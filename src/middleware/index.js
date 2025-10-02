const helmet = require('helmet');
const cors = require('cors');
const express = require('express');

module.exports = (app) => {
  app.use(helmet());
  app.use(cors());
  app.use('/webhook', express.raw({ type: 'application/json' }));
  app.use(express.json());
};