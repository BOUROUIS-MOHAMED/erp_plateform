const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');
const User = require('../src/models/User');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const USERS = [
  {
    firstName: 'Admin',
    lastName: 'Principal',
    email: 'admin@test.com',
    password: 'password',
    role: 'admin_principal',
    department: 'administration',
    isActive: true
  },
  {
    firstName: 'Gestionnaire',
    lastName: 'Stock',
    email: 'stock@erp.com',
    password: 'stock123',
    role: 'admin_stock',
    department: 'stock',
    isActive: true
  },
  {
    firstName: 'Gestionnaire',
    lastName: 'Finance',
    email: 'finance@erp.com',
    password: 'finance123',
    role: 'admin_finance',
    department: 'finance',
    isActive: true
  },
  {
    firstName: 'Gestionnaire',
    lastName: 'Facturation',
    email: 'facturation@erp.com',
    password: 'fact123',
    role: 'admin_facture',
    department: 'facturation',
    isActive: true
  }
];

async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/zee';
  await mongoose.connect(uri);
}

async function upsertUser(userData) {
  const existingUser = await User.findOne({ email: userData.email });

  if (existingUser) {
    existingUser.firstName = userData.firstName;
    existingUser.lastName = userData.lastName;
    existingUser.role = userData.role;
    existingUser.department = userData.department;
    existingUser.isActive = userData.isActive;
    // Always reset password to make sure login credentials are correct.
    existingUser.password = userData.password;
    await existingUser.save();
    return 'updated';
  }

  await User.create(userData);
  return 'created';
}

async function seedUsers() {
  await connectDB();

  const failures = [];
  const results = [];

  try {
    for (const userData of USERS) {
      try {
        const action = await upsertUser(userData);
        results.push({ email: userData.email, role: userData.role, action });
      } catch (error) {
        failures.push({ email: userData.email, error: error.message });
      }
    }

    results.forEach((item) => {
      console.log(`${item.action.toUpperCase()}: ${item.email} (${item.role})`);
    });

    if (failures.length > 0) {
      failures.forEach((item) => {
        console.error(`FAILED: ${item.email} -> ${item.error}`);
      });
      throw new Error('One or more users could not be inserted.');
    }

    console.log('\nSeeded users:');
    USERS.forEach((user) => {
      console.log(`${user.email} / ${user.password}`);
    });
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  seedUsers()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}

module.exports = { seedUsers, USERS };
