const { start } = require('./src');

process.on('SIGTERM', async () => {
  console.log('🔄 Arrêt...');
  const { getDb } = require('./src/database/connection');
  const db = getDb();
  if (db) await db.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🔄 Arrêt...');
  const { getDb } = require('./src/database/connection');
  const db = getDb();
  if (db) await db.end();
  process.exit(0);
});

start().catch(console.error);