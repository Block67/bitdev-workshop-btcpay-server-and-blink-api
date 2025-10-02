const mysql = require('mysql2/promise');
const config = require('../config');

let db;

async function initDatabase() {
  try {
    db = await mysql.createConnection(config.db);
    console.log('✅ Base de données connectée');
    await createTable();
    return db;
  } catch (error) {
    console.error('❌ Erreur DB:', error.message);
    process.exit(1);
  }
}

async function createTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      invoice_id VARCHAR(255) UNIQUE NOT NULL,
      amount_sats BIGINT NOT NULL,
      amount_btc DECIMAL(16,8) NOT NULL,
      email VARCHAR(255) NULL,
      description TEXT,
      status ENUM('pending', 'paid', 'expired', 'invalid') DEFAULT 'pending',
      checkout_link TEXT,
      bolt11 TEXT,
      payment_hash VARCHAR(255),
      metadata JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      paid_at TIMESTAMP NULL,
      INDEX idx_invoice_id (invoice_id),
      INDEX idx_status (status),
      INDEX idx_email (email)
    )
  `;
  await db.execute(sql);
  console.log('✅ Table payments prête');
}

module.exports = { initDatabase, getDb: () => db };