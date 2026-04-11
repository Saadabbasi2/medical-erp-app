const mongoose = require('mongoose');
const { getFlutterAppConnection } = require('../dbFlutterApp');

const salesmanHistorySchema = new mongoose.Schema({
  id: { type: String, required: true },
  module: { type: String, required: true },
  action: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  file_path: { type: String, default: '' },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  salesman_id: { type: String, default: '' } // Link to salesman who performed action
}, { timestamps: true });

// Get model from Flutter app connection if available
function getModel() {
  const connection = getFlutterAppConnection();
  if (connection && connection.readyState === 1) {
    if (connection.models.SalesmanHistory) {
      return connection.models.SalesmanHistory;
    }
    return connection.model('SalesmanHistory', salesmanHistorySchema);
  }
  // Fallback to default connection
  if (mongoose.models.SalesmanHistory) {
    return mongoose.models.SalesmanHistory;
  }
  return mongoose.model('SalesmanHistory', salesmanHistorySchema);
}

// Export a proxy that always gets the current model
module.exports = new Proxy({}, {
  get: function(target, prop) {
    const model = getModel();
    return model[prop];
  }
});
