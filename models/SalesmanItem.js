const mongoose = require('mongoose');
const { getFlutterAppConnection } = require('../dbFlutterApp');

const salesmanItemSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, default: 0 },
  category: { type: String, default: '' },
  description: { type: String, default: '' },
  // Store any additional fields as flexible schema
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

// Get model from Flutter app connection if available
function getModel() {
  const connection = getFlutterAppConnection();
  if (connection && connection.readyState === 1) {
    // Check if model already exists on this connection
    if (connection.models.SalesmanItem) {
      return connection.models.SalesmanItem;
    }
    return connection.model('SalesmanItem', salesmanItemSchema);
  }
  // Fallback to default connection
  if (mongoose.models.SalesmanItem) {
    return mongoose.models.SalesmanItem;
  }
  return mongoose.model('SalesmanItem', salesmanItemSchema);
}

// Export a proxy that always gets the current model
module.exports = new Proxy({}, {
  get: function(target, prop) {
    const model = getModel();
    return model[prop];
  }
});
