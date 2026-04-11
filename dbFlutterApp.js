// dbFlutterApp.js - Separate database connection for Flutter Salesman App
const mongoose = require('mongoose');

let flutterAppConnection = null;

async function connectFlutterAppDB() {
  if (flutterAppConnection && flutterAppConnection.readyState === 1) {
    return flutterAppConnection;
  }

  // Use separate database name: "fizan_medicine_app"
  const baseUri = process.env.MONGO_URI || 'mongodb://localhost:27017';
  const dbName = 'fizan_medicine_app';
  
  // Extract base URI (without database name)
  let uri;
  if (baseUri.includes('/') && !baseUri.endsWith('/')) {
    const parts = baseUri.split('/');
    uri = parts.slice(0, -1).join('/') + '/' + dbName;
  } else {
    uri = baseUri.replace(/\/[^\/]*$/, '') + '/' + dbName;
  }
  
  mongoose.set('strictQuery', false);

  try {
    flutterAppConnection = mongoose.createConnection(uri);
    
    flutterAppConnection.on('connected', () => {
      console.log('✅ Flutter App MongoDB connected to database: fizan_medicine_app');
    });
    
    flutterAppConnection.on('error', (err) => {
      console.error('❌ Flutter App MongoDB connection error:', err);
    });
    
    // Wait for connection to be ready
    await new Promise((resolve, reject) => {
      if (flutterAppConnection.readyState === 1) {
        resolve();
        return;
      }
      
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);
      
      flutterAppConnection.once('open', () => {
        clearTimeout(timeout);
        resolve();
      });
      
      flutterAppConnection.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
    
    return flutterAppConnection;
  } catch (err) {
    console.error('❌ Flutter App MongoDB connection error:', err);
    throw err;
  }
}

function getFlutterAppConnection() {
  return flutterAppConnection;
}

module.exports = { connectFlutterAppDB, getFlutterAppConnection };
