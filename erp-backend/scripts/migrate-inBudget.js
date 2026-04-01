// One-time migration: rename Account.inBudget → Account.inMoneyFlow
// Run: node erp-backend/scripts/migrate-inBudget.js

const mongoose = require('mongoose');
require('dotenv').config();

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/erp');
  const result = await mongoose.connection.collection('accounts').updateMany(
    { inBudget: { $exists: true } },
    [{ $set: { inMoneyFlow: '$inBudget' } }, { $unset: 'inBudget' }]
  );
  console.log(`Migrated ${result.modifiedCount} accounts`);
  await mongoose.disconnect();
}

migrate().catch(console.error);
