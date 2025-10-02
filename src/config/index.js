require('dotenv').config();

module.exports = {
  db: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
  },
  btcpay: {
    serverUrl: process.env.BTCPAY_SERVER_URL,
    storeId: process.env.BTCPAY_STORE_ID,
    apiKey: process.env.BTCPAY_API_KEY,
    webhookSecret: process.env.BTCPAY_WEBHOOK_SECRET,
  },
  port: process.env.PORT || 3000,
};