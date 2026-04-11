// routes/dmsMasters.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

// Supported master types
const masterTypes = [
  'regions', 'customers', 'itemcategories', 'vendors', 'companies',
  'items', 'medcourses', 'policies', 'managers', 'vehicletypes', 'vehicles'
];

// Special paged endpoint for items (to avoid loading thousands at once)
router.get('/items/paged', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const offset = Math.max(0, parseInt(req.query.offset) || 0);
    const pool = getPool();

    const [items] = await pool.query(
      `
      SELECT
        *,
        (CAST(territory AS SIGNED) - DATEDIFF(CURDATE(), DATE(created_at))) AS nearExpiryRemaining,
        CASE
          WHEN (CAST(territory AS SIGNED) - DATEDIFF(CURDATE(), DATE(created_at))) < 0 THEN 1
          ELSE 0
        END AS isExpired
      FROM dms_masters
      WHERE master_type = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?
      `,
      ['items', limit, offset]
    );
    const [countRow] = await pool.query(
      'SELECT COUNT(*) as total FROM dms_masters WHERE master_type = ?',
      ['items']
    );

    res.json({ items, total: countRow[0].total });
  } catch (err) {
    console.error('Get paged DMS items error:', err);
    res.status(500).json({ error: 'Failed to get items' });
  }
});

// Generic handlers for all master types
masterTypes.forEach(masterType => {

  // GET list
  router.get(`/${masterType}`, async (req, res) => {
    try {
      const pool = getPool();
      const [records] = await pool.query('SELECT * FROM dms_masters WHERE master_type = ? ORDER BY created_at DESC', [masterType]);
      res.json(records);
    } catch (err) {
      console.error(`Get ${masterType} error:`, err);
      res.status(500).json({ error: 'Failed to get records' });
    }
  });

  // POST add
  router.post(`/${masterType}`, async (req, res) => {
    try {
      const pool = getPool();
      const { code, name, description, region, territory, status } = req.body;

      const [result] = await pool.query(`
        INSERT INTO dms_masters (master_type, code, name, description, region, territory, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [masterType, code || '', name || '', description || '', region || '', territory || '', status || 'Active']);

      const [newRecord] = await pool.query('SELECT * FROM dms_masters WHERE id = ?', [result.insertId]);
      res.json({ success: true, data: newRecord[0] });
    } catch (err) {
      console.error(`Add ${masterType} error:`, err);
      res.status(500).json({ error: 'Failed to add' });
    }
  });

  // DELETE
  router.delete(`/${masterType}/:id`, async (req, res) => {
    try {
      const pool = getPool();
      await pool.query('DELETE FROM dms_masters WHERE id = ? AND master_type = ?', [parseInt(req.params.id), masterType]);
      res.json({ success: true });
    } catch (err) {
      console.error(`Delete ${masterType} error:`, err);
      res.status(500).json({ error: 'Failed to delete' });
    }
  });

  // PDF export
  router.get(`/${masterType}/export/pdf`, async (req, res) => {
    try {
      const pool = getPool();
      // If Items tab is filtered by search, export only those rows
      const q = String(req.query.q || '').trim();
      let records = [];
      if (masterType === 'items' && q) {
        const like = `%${q}%`;
        const [rows] = await pool.query(
          `
          SELECT * FROM dms_masters
          WHERE master_type = ?
            AND (code LIKE ? OR name LIKE ?)
          ORDER BY created_at DESC, id DESC
          `,
          [masterType, like, like]
        );
        records = rows;
      } else {
        const [rows] = await pool.query(
          'SELECT * FROM dms_masters WHERE master_type = ? ORDER BY created_at DESC, id DESC',
          [masterType]
        );
        records = rows;
      }

      // Column mappings for different master types
      const columnMaps = {
        regions: [
          { label: 'Code', key: 'code', widthRatio: 0.2 },
          { label: 'Name', key: 'name', widthRatio: 0.4 },
          { label: 'Description', key: 'description', widthRatio: 0.4 }
        ],
        customers: [
          { label: 'Code', key: 'code', widthRatio: 0.15 },
          { label: 'Name', key: 'name', widthRatio: 0.30 },
          { label: 'Region', key: 'region', widthRatio: 0.20 },
          { label: 'Territory', key: 'territory', widthRatio: 0.20 },
          { label: 'Status', key: 'status', widthRatio: 0.15 }
        ],
        itemcategories: [
          { label: 'Code', key: 'code', widthRatio: 0.2 },
          { label: 'Name', key: 'name', widthRatio: 0.5 },
          { label: 'Description', key: 'description', widthRatio: 0.3 }
        ],
        vendors: [
          { label: 'Code', key: 'code', widthRatio: 0.2 },
          { label: 'Name', key: 'name', widthRatio: 0.5 },
          { label: 'Status', key: 'status', widthRatio: 0.3 }
        ],
        companies: [
          { label: 'Code', key: 'code', widthRatio: 0.2 },
          { label: 'Name', key: 'name', widthRatio: 0.6 },
          { label: 'Status', key: 'status', widthRatio: 0.2 }
        ],
        items: [
          { label: 'Code', key: 'code', widthRatio: 0.12 },
          { label: 'Name', key: 'name', widthRatio: 0.28 },
          { label: 'Pack Size', key: 'description', widthRatio: 0.20 },
          { label: 'Company ID', key: 'region', widthRatio: 0.20 },
          { label: 'Near Expiry Days', key: 'territory', widthRatio: 0.20 }
        ],
        medcourses: [
          { label: 'Code', key: 'code', widthRatio: 0.2 },
          { label: 'Description', key: 'description', widthRatio: 0.6 },
          { label: 'Status', key: 'status', widthRatio: 0.2 }
        ],
        policies: [
          { label: 'Code', key: 'code', widthRatio: 0.2 },
          { label: 'Description', key: 'description', widthRatio: 0.6 },
          { label: 'Status', key: 'status', widthRatio: 0.2 }
        ],
        managers: [
          { label: 'Manager ID', key: 'code', widthRatio: 0.20 },
          { label: 'Company ID', key: 'region', widthRatio: 0.20 },
          { label: 'Name', key: 'name', widthRatio: 0.60 }
        ],
        vehicletypes: [
          { label: 'Code', key: 'code', widthRatio: 0.3 },
          { label: 'Description', key: 'description', widthRatio: 0.7 }
        ],
        vehicles: [
          { label: 'Code', key: 'code', widthRatio: 0.2 },
          { label: 'Name', key: 'name', widthRatio: 0.4 },
          { label: 'Description', key: 'description', widthRatio: 0.4 }
        ]
      };

      const columns = columnMaps[masterType] || [
        { label: 'Code', key: 'code', widthRatio: 0.2 },
        { label: 'Name', key: 'name', widthRatio: 0.5 },
        { label: 'Status', key: 'status', widthRatio: 0.3 }
      ];

      const formatted = records.map(r => ({
        code: r.code || '-',
        name: r.name || '-',
        description: r.description || '-',
        region: r.region || '-',
        territory: r.territory || '-',
        status: r.status || '-'
      }));

      const title = `${masterType.replace(/([A-Z])/g, ' $1')} Report`;
      const filename = `${masterType}_report.pdf`;

      generateERPTablePDF(res, formatted, columns, title, filename);
    } catch (err) {
      console.error('Export PDF error:', err);
      res.status(500).json({ error: 'Failed to export' });
    }
  });
});

module.exports = router;
