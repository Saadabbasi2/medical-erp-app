// routes/dmsOperations.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [operations] = await pool.query('SELECT * FROM dms_operations ORDER BY created_at DESC');
    res.json(operations);
  } catch (err) {
    console.error('Get DMS operations error:', err);
    res.status(500).json({ error: 'Failed to get operations' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { operationType, operationNo, distributorId, distributorName, region, territory, operationDate, totalAmount, quantity, status, remarks, createdBy } = req.body;

    const [result] = await pool.query(`
      INSERT INTO dms_operations (operation_type, operation_no, distributor_id, distributor_name, region, territory, operation_date, total_amount, quantity, status, remarks, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      operationType || '',
      operationNo || `DMS-${Date.now()}`,
      distributorId || null,
      distributorName || '',
      region || '',
      territory || '',
      operationDate || new Date().toISOString().split('T')[0],
      totalAmount || 0,
      quantity || 0,
      status || 'Pending',
      remarks || '',
      createdBy || 'User'
    ]);

    const [newOperation] = await pool.query('SELECT * FROM dms_operations WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newOperation[0] });
  } catch (err) {
    console.error('Create DMS operation error:', err);
    res.status(500).json({ error: 'Failed to create operation' });
  }
});

router.put('/:id/approve', async (req, res) => {
  try {
    const pool = getPool();
    const { approvedBy } = req.body;

    await pool.query(`
      UPDATE dms_operations 
      SET status = 'Approved', approved_by = ?, approved_at = NOW()
      WHERE id = ?
    `, [approvedBy || 'Admin', parseInt(req.params.id)]);

    const [updated] = await pool.query('SELECT * FROM dms_operations WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    console.error('Approve operation error:', err);
    res.status(500).json({ error: 'Failed to approve operation' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM dms_operations WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [operations] = await pool.query('SELECT * FROM dms_operations');

    const formatted = operations.map(o => ({
      operationNo: o.operation_no || '-',
      operationType: o.operation_type || '-',
      distributorName: o.distributor_name || '-',
      region: o.region || '-',
      operationDate: o.operation_date || '-',
      totalAmount: (parseFloat(o.total_amount) || 0).toFixed(2),
      quantity: o.quantity || 0,
      status: o.status || '-'
    }));

    const columns = [
      { label: 'Operation No', key: 'operationNo', widthRatio: 0.12 },
      { label: 'Type', key: 'operationType', widthRatio: 0.12 },
      { label: 'Distributor', key: 'distributorName', widthRatio: 0.20 },
      { label: 'Region', key: 'region', widthRatio: 0.12 },
      { label: 'Date', key: 'operationDate', widthRatio: 0.12 },
      { label: 'Amount', key: 'totalAmount', widthRatio: 0.12 },
      { label: 'Qty', key: 'quantity', widthRatio: 0.08 },
      { label: 'Status', key: 'status', widthRatio: 0.12 }
    ];

    generateERPTablePDF(res, formatted, columns, 'DMS Operations Report', 'dms_operations.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
