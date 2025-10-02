const express = require('express');
const applyMiddleware = require('./middleware');
const paymentRoutes = require('./routes/payment');
const webhookRoutes = require('./routes/webhook');
const healthRoutes = require('./routes/health');
const { initDatabase } = require('./database/connection');
const config = require('./config');

const app = express();

async function start() {
  await initDatabase();
  applyMiddleware(app);

  // Routes
  app.use('/api/payment', paymentRoutes);
  app.use('/webhook', webhookRoutes);
  app.use('/health', healthRoutes);

  // 404 Handler
  app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route non trouvée' });
  });

  app.listen(config.port, () => {
    console.log(`🚀 Serveur démarré sur le port ${config.port}`);
    console.log(`📊 Health: http://localhost:${config.port}/health`);
    console.log(`💰 API: http://localhost:${config.port}/api/payment`);
  });
}

module.exports = { app, start };