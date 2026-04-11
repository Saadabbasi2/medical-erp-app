// routes/fleetRoute.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [routes] = await pool.query('SELECT * FROM fleet_route ORDER BY created_at DESC');
    res.json(routes);
  } catch (err) {
    console.error('Get fleet routes error:', err);
    res.status(500).json({ error: 'Failed to get routes' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { routeCode, routeName, vehicleId, driverName, region, territory, status } = req.body;

    const [result] = await pool.query(`
      INSERT INTO fleet_route (route_code, route_name, vehicle_id, driver_name, region, territory, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      routeCode || `RT-${Date.now()}`,
      routeName || '',
      vehicleId || null,
      driverName || '',
      region || '',
      territory || '',
      status || 'Active'
    ]);

    const [newRoute] = await pool.query('SELECT * FROM fleet_route WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newRoute[0] });
  } catch (err) {
    console.error('Create fleet route error:', err);
    res.status(500).json({ error: 'Failed to create route' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM fleet_route WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [routes] = await pool.query('SELECT * FROM fleet_route');

    const formatted = routes.map(r => ({
      code: r.route_code || '-',
      name: r.route_name || '-',
      driver: r.driver_name || '-',
      region: r.region || '-',
      territory: r.territory || '-',
      status: r.status || '-'
    }));

    const columns = [
      { label: 'Code', key: 'code', widthRatio: 0.12 },
      { label: 'Route Name', key: 'name', widthRatio: 0.25 },
      { label: 'Driver', key: 'driver', widthRatio: 0.20 },
      { label: 'Region', key: 'region', widthRatio: 0.15 },
      { label: 'Territory', key: 'territory', widthRatio: 0.15 },
      { label: 'Status', key: 'status', widthRatio: 0.13 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Fleet Routes', 'fleet_routes.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
