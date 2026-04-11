const mongoose = require('mongoose');
const { getFlutterAppConnection } = require('../dbFlutterApp');

const salesmanOrderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  customer_id: { type: String, required: true },
  customer_name: { type: String, required: true },
  customer_phone: { type: String, default: '' },
  items: [{
    item_name: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true }
  }],
  total: { type: Number, required: true },
  delivery_status: { 
    type: String, 
    enum: ['delivered', 'not_delivered', 'pending'],
    default: 'pending'
  },
  created_at: { type: Date, default: Date.now },
  delivery_date: { type: Date, default: null },
  salesman_id: { type: String, default: '' }, // Link to salesman who created order
  // Store any additional fields as flexible schema
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

// Get model from Flutter app connection if available
function getModel() {
  const connection = getFlutterAppConnection();
  if (connection && connection.readyState === 1) {
    if (connection.models.SalesmanOrder) {
      return connection.models.SalesmanOrder;
    }
    return connection.model('SalesmanOrder', salesmanOrderSchema);
  }
  // Fallback to default connection
  if (mongoose.models.SalesmanOrder) {
    return mongoose.models.SalesmanOrder;
  }
  return mongoose.model('SalesmanOrder', salesmanOrderSchema);
}

// Export a proxy that always gets the current model
module.exports = new Proxy({}, {
  get: function(target, prop) {
    const model = getModel();
    return model[prop];
  }
});
