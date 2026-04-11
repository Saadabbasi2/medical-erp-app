const mongoose = require('mongoose');

const salesmanSchema = new mongoose.Schema({
  name: { type: String, required: true },
  loginID: { type: String, required: true, unique: true },
  password: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Salesman', salesmanSchema);

