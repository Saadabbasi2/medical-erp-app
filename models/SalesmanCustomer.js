const mongoose = require('mongoose');
const { getFlutterAppConnection } = require('../dbFlutterApp');

const salesmanCustomerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  address: { type: String, default: '' },
  // Store any additional fields as flexible schema
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

// Get model from Flutter app connection if available
function getModel() {
  const connection = getFlutterAppConnection();
  if (connection && connection.readyState === 1) {
    if (connection.models.SalesmanCustomer) {
      return connection.models.SalesmanCustomer;
    }
    return connection.model('SalesmanCustomer', salesmanCustomerSchema);
  }
  // Fallback to default connection
  if (mongoose.models.SalesmanCustomer) {
    return mongoose.models.SalesmanCustomer;
  }
  return mongoose.model('SalesmanCustomer', salesmanCustomerSchema);
}

// Export a proxy that always gets the current model
module.exports = new Proxy({}, {
  get: function(target, prop) {
    const model = getModel();
    return model[prop];
  }
});
