// routes/salesmanDepartment.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const crypto = require('crypto');
const router = express.Router();

function normalizeLoginId(v) {
  return String(v || '').trim();
}

// Password storage format:
// pbkdf2$<iterations>$<saltB64>$<hashB64>
function hashPasswordPbkdf2(password, iterations = 120000) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(String(password), salt, iterations, 32, 'sha256');
  return `pbkdf2$${iterations}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function verifyPassword(stored, provided) {
  const storedStr = String(stored || '');
  const providedStr = String(provided || '');
  if (!storedStr) return false;

  // Backwards compatible: accept legacy plain-text
  if (!storedStr.startsWith('pbkdf2$')) {
    return storedStr === providedStr;
  }

  const parts = storedStr.split('$');
  if (parts.length !== 4) return false;
  const iterations = parseInt(parts[1]);
  const salt = Buffer.from(parts[2], 'base64');
  const expected = Buffer.from(parts[3], 'base64');
  if (!Number.isFinite(iterations) || iterations < 10000) return false;

  const actual = crypto.pbkdf2Sync(providedStr, salt, iterations, expected.length, 'sha256');
  return crypto.timingSafeEqual(expected, actual);
}

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    // Salesman credentials are stored in `salesmen` table (per schema.sql)
    const [rows] = await pool.query('SELECT id, name, login_id, password FROM salesmen ORDER BY created_at DESC, id DESC');
    res.json(rows.map(r => ({
      id: r.id,
      name: r.name || '',
      loginID: r.login_id || '',
      password: r.password || ''
    })));
  } catch (err) {
    console.error('Get salesman departments error:', err);
    res.status(500).json({ error: 'Failed to get departments' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const {
      // ERP UI sends: { name, loginID, password }
      name,
      loginID,
      password,
      // ignore department payloads if any old clients send them
    } = req.body;

    const login = normalizeLoginId(loginID);
    if (!login || !password) {
      return res.status(400).json({ success: false, error: 'loginID and password required' });
    }

    // Prevent duplicate login IDs
    const [existing] = await pool.query('SELECT id FROM salesmen WHERE login_id = ? LIMIT 1', [login]);
    if (existing.length) {
      return res.status(409).json({ success: false, error: 'Login ID already exists' });
    }

    const passwordHash = hashPasswordPbkdf2(password);

    const [result] = await pool.query(
      `INSERT INTO salesmen (name, login_id, password) VALUES (?, ?, ?)`,
      [(name || '').trim(), login, passwordHash]
    );

    const [newRow] = await pool.query('SELECT id, name, login_id FROM salesmen WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newRow[0] });
  } catch (err) {
    console.error('Create department error:', err);
    res.status(500).json({ error: 'Failed to create department' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM salesmen WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM salesmen ORDER BY created_at DESC, id DESC');

    const formatted = rows.map(s => ({
      name: s.name || '-',
      loginID: s.login_id || '-',
      createdAt: s.created_at ? new Date(s.created_at).toLocaleString() : '-'
    }));

    const columns = [
      { label: 'Name', key: 'name', widthRatio: 0.45, align: 'left' },
      { label: 'Login ID', key: 'loginID', widthRatio: 0.35, align: 'left' },
      { label: 'Created', key: 'createdAt', widthRatio: 0.20, align: 'left' }
    ];

    generateERPTablePDF(res, formatted, columns, 'Salesmen', 'salesmen.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

// Authentication endpoint for salesman login
router.post('/auth/login', async (req, res) => {
  try {
    const { loginID, password } = req.body || {};
    const login = normalizeLoginId(loginID);
    if (!login || !password) {
      return res.status(400).json({ success: false, error: 'loginID and password required' });
    }
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT id, login_id, password, name FROM salesmen WHERE login_id = ? LIMIT 1',
      [login]
    );
    if (rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    const user = rows[0];
    const ok = verifyPassword(user.password, password);
    if (!ok) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    res.json({
      success: true,
      user: {
        id: user.id,
        loginID: user.login_id,
        name: user.name || ''
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
