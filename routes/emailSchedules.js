// routes/emailSchedules.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [schedules] = await pool.query('SELECT * FROM email_schedules ORDER BY created_at DESC');
    res.json(schedules);
  } catch (err) {
    console.error('Get email schedules error:', err);
    res.status(500).json({ error: 'Failed to get schedules' });
  }
});

router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { scheduleName, recipientEmail, subject, body, scheduleType, scheduleTime, scheduleDate, status } = req.body;

    const [result] = await pool.query(`
      INSERT INTO email_schedules (schedule_name, recipient_email, subject, body, schedule_type, schedule_time, schedule_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      scheduleName || '',
      recipientEmail || '',
      subject || '',
      body || '',
      scheduleType || 'Once',
      scheduleTime || null,
      scheduleDate || null,
      status || 'Active'
    ]);

    const [newSchedule] = await pool.query('SELECT * FROM email_schedules WHERE id = ?', [result.insertId]);
    res.json({ success: true, data: newSchedule[0] });
  } catch (err) {
    console.error('Create email schedule error:', err);
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

router.put('/:id/send', async (req, res) => {
  try {
    const pool = getPool();

    await pool.query(`
      UPDATE email_schedules 
      SET last_sent = NOW()
      WHERE id = ?
    `, [parseInt(req.params.id)]);

    const [updated] = await pool.query('SELECT * FROM email_schedules WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    console.error('Send email error:', err);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM email_schedules WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

router.get('/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [schedules] = await pool.query('SELECT * FROM email_schedules');

    const formatted = schedules.map(s => ({
      name: s.schedule_name || '-',
      recipient: s.recipient_email || '-',
      subject: s.subject || '-',
      scheduleType: s.schedule_type || '-',
      scheduleDate: s.schedule_date || '-',
      status: s.status || '-'
    }));

    const columns = [
      { label: 'Name', key: 'name', widthRatio: 0.20 },
      { label: 'Recipient', key: 'recipient', widthRatio: 0.25 },
      { label: 'Subject', key: 'subject', widthRatio: 0.20 },
      { label: 'Type', key: 'scheduleType', widthRatio: 0.12 },
      { label: 'Date', key: 'scheduleDate', widthRatio: 0.12 },
      { label: 'Status', key: 'status', widthRatio: 0.11 }
    ];

    generateERPTablePDF(res, formatted, columns, 'Email Schedules', 'email_schedules.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;
