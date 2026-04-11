   // db.js
const mongoose = require('mongoose');
const { initMongoSync } = require('./mongoSync');

async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/medical_erp';
  mongoose.set('strictQuery', false);

  try {
    await mongoose.connect(uri);
    console.log('✅ MongoDB connected');
    initMongoSync();
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }
}

module.exports = connectDB;