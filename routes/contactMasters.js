// routes/contactMasters.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [contacts] = await pool.query('SELECT * FROM contact_masters ORDER BY created_at DESC');
    res.json(contacts);
  } catch (err) {
    console.error('Get contacts error:', err);
    res.status(500).json({ error: 'Failed to get contacts' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { contactType, name, company, phone, email, address, city, country, status } = req.body;

    const [result] = await pool.query(`
      INSERT INTO contact_masters (contact_type, name, company, phone, email, address, city, country, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [contactType || '', name || '', company || '', phone || '', email || '', address || '', city || '', country || '', status || 'Active']);

    const [newContact] = await pool.query('SELECT * FROM contact_masters WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newContact[0] });
  } catch (err) {
    console.error('Create contact error:', err);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM contact_masters WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [contacts] = await pool.query('SELECT * FROM contact_masters');

    const formatted = contacts.map(c => ({
      type: c.contact_type || '-',
      name: c.name || '-',
      company: c.company || '-',
      phone: c.phone || '-',
      email: c.email || '-',
      city: c.city || '-'
    }));

    const columns = [
      { label: 'Type', key: 'type', widthRatio: 0.12 },
      { label: 'Name', key: 'name', widthRatio: 0.20 },
      { label: 'Company', key: 'company', widthRatio: 0.18 },
      { label: 'Phone', key: 'phone', widthRatio: 0.15 },
      { label: 'Email', key: 'email', widthRatio: 0.20 },
      { label: 'City', key: 'city', widthRatio: 0.15 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Contact Masters', 'contact_masters.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
