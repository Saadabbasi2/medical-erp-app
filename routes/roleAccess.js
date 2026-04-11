// routes/roleAccess.js - MySQL Version
const express = require("express");
const path = require("path");
const ExcelJS = require("exceljs");
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require("../utils/pdfTemplate");

const router = express.Router();

// Get all role access records
router.get("/", async (req, res) => {
  try {
    const pool = getPool();
    const [roles] = await pool.query(`
      SELECT id, role_name, branch, region, permissions, status,
             maker, checker, approved_by, approved_at, rejected_by,
             created_at, updated_at
      FROM role_access
      ORDER BY created_at DESC
    `);

    // Format for compatibility
    const formatted = roles.map(r => ({
      id: r.id,
      roleName: r.role_name,
      branch: r.branch,
      region: r.region,
      permissions: r.permissions,
      status: r.status,
      maker: r.maker,
      checker: r.checker,
      approvedBy: r.approved_by,
      approvedAt: r.approved_at,
      rejectedBy: r.rejected_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Get role access error:', err);
    res.status(500).json([]);
  }
});

// Create role access
router.post("/", async (req, res) => {
  try {
    const pool = getPool();
    const {
      roleName,
      branch,
      region,
      permissions,
      maker,
      checker
    } = req.body;

    const [result] = await pool.query(`
      INSERT INTO role_access (
        role_name, branch, region, permissions, status, maker, checker,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      roleName || '',
      branch || '',
      region || '',
      permissions || '',
      'Pending',
      maker || '',
      checker || ''
    ]);

    const [newRole] = await pool.query(`SELECT * FROM role_access WHERE id = ?`, [result.insertId]);
    const role = newRole[0];

    res.json({
      success: true,
      role: {
        id: role.id,
        roleName: role.role_name,
        branch: role.branch,
        region: role.region,
        permissions: role.permissions,
        status: role.status,
        maker: role.maker,
        checker: role.checker,
        createdAt: role.created_at,
        updatedAt: role.updated_at
      }
    });
  } catch (err) {
    console.error('Create role access error:', err);
    res.status(500).json({ error: 'Failed to create role access' });
  }
});

// Delete role access
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const pool = getPool();

    await pool.query(`DELETE FROM role_access WHERE id = ?`, [id]);

    res.json({ success: true });
  } catch (err) {
    console.error('Delete role access error:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// Approve role access
router.patch("/approve/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const approvedBy = req.body.approvedBy || "System Checker";
      const remarks = req.body.remarks || "Approved successfully";

      await connection.query(`
        UPDATE role_access
        SET status = ?, approved_by = ?, approved_at = NOW(), updated_at = NOW()
        WHERE id = ?
      `, ["Approved", approvedBy, id]);

      // Log to history
      const [roleData] = await connection.query(`SELECT * FROM role_access WHERE id = ?`, [id]);
      const role = roleData[0];

      if (role) {
        await connection.query(`
          INSERT INTO role_access_history (
            role_access_id, action, maker, checker, performed_by, remarks
          ) VALUES (?, ?, ?, ?, ?, ?)
        `, [id, "Approved", role.maker, role.checker, approvedBy, remarks]);
      }

      await connection.commit();

      const [updated] = await connection.query(`SELECT * FROM role_access WHERE id = ?`, [id]);
      const updatedRole = updated[0];

      connection.release();

      res.json({
        success: true,
        role: {
          id: updatedRole.id,
          roleName: updatedRole.role_name,
          status: updatedRole.status,
          approvedBy: updatedRole.approved_by,
          approvedAt: updatedRole.approved_at
        }
      });
    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  } catch (err) {
    console.error('Approve role access error:', err);
    res.status(500).json({ error: 'Failed to approve' });
  }
});

// Reject role access
router.patch("/reject/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const rejectedBy = req.body.rejectedBy || "System Checker";
      const remarks = req.body.remarks || "Rejected by checker";

      await connection.query(`
        UPDATE role_access
        SET status = ?, rejected_by = ?, updated_at = NOW()
        WHERE id = ?
      `, ["Rejected", rejectedBy, id]);

      // Log to history
      const [roleData] = await connection.query(`SELECT * FROM role_access WHERE id = ?`, [id]);
      const role = roleData[0];

      if (role) {
        await connection.query(`
          INSERT INTO role_access_history (
            role_access_id, action, maker, checker, performed_by, remarks
          ) VALUES (?, ?, ?, ?, ?, ?)
        `, [id, "Rejected", role.maker, role.checker, rejectedBy, remarks]);
      }

      await connection.commit();

      const [updated] = await connection.query(`SELECT * FROM role_access WHERE id = ?`, [id]);
      const updatedRole = updated[0];

      connection.release();

      res.json({
        success: true,
        role: {
          id: updatedRole.id,
          roleName: updatedRole.role_name,
          status: updatedRole.status,
          rejectedBy: updatedRole.rejected_by
        }
      });
    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  } catch (err) {
    console.error('Reject role access error:', err);
    res.status(500).json({ error: 'Failed to reject' });
  }
});

// Get approval history
router.get("/history", async (req, res) => {
  try {
    const pool = getPool();
    const [history] = await pool.query(`
      SELECT id, role_access_id as roleId, action, maker, checker,
             performed_by as performedBy, timestamp, remarks
      FROM role_access_history
      ORDER BY timestamp DESC
    `);

    res.json(history);
  } catch (err) {
    console.error('Get history error:', err);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// Export PDF
router.get("/export/pdf", async (req, res) => {
  try {
    const pool = getPool();
    const [data] = await pool.query(`
      SELECT role_name, branch, region, permissions, status, maker, checker
      FROM role_access
      ORDER BY created_at DESC
    `);

    const formatted = data.map(d => ({
      roleName: d.role_name || '-',
      branch: d.branch || '-',
      region: d.region || '-',
      permissions: d.permissions || '-',
      status: d.status || '-',
      maker: d.maker || '-',
      checker: d.checker || '-'
    }));

    const columns = [
      { label: "Role Name", key: "roleName", widthRatio: 0.2 },
      { label: "Branch", key: "branch", widthRatio: 0.15 },
      { label: "Region", key: "region", widthRatio: 0.15 },
      { label: "Permissions", key: "permissions", widthRatio: 0.25 },
      { label: "Status", key: "status", widthRatio: 0.15 },
      { label: "Maker", key: "maker", widthRatio: 0.15 },
      { label: "Checker", key: "checker", widthRatio: 0.15 },
    ];

    generateERPTablePDF(res, formatted, columns, "Role-Based Access Summary", "Role_Access.pdf");
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

// Export Excel
router.get("/export/excel", async (req, res) => {
  try {
    const pool = getPool();
    const [data] = await pool.query(`SELECT * FROM role_access ORDER BY created_at DESC`);
    const [history] = await pool.query(`SELECT * FROM role_access_history ORDER BY timestamp DESC`);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Role Access");

    sheet.columns = [
      { header: "Role Name", key: "role_name", width: 25 },
      { header: "Branch", key: "branch", width: 15 },
      { header: "Region", key: "region", width: 15 },
      { header: "Permissions", key: "permissions", width: 30 },
      { header: "Maker", key: "maker", width: 20 },
      { header: "Checker", key: "checker", width: 20 },
      { header: "Status", key: "status", width: 15 },
      { header: "Approved By", key: "approved_by", width: 20 },
      { header: "Approved At", key: "approved_at", width: 25 },
    ];

    data.forEach(d => sheet.addRow(d));

    // History sheet
    const histSheet = workbook.addWorksheet("Approval History");
    histSheet.columns = [
      { header: "Role ID", key: "role_access_id", width: 15 },
      { header: "Action", key: "action", width: 15 },
      { header: "Maker", key: "maker", width: 20 },
      { header: "Checker", key: "checker", width: 20 },
      { header: "Performed By", key: "performed_by", width: 20 },
      { header: "Timestamp", key: "timestamp", width: 25 },
      { header: "Remarks", key: "remarks", width: 40 },
    ];
    history.forEach(h => histSheet.addRow(h));

    const filePath = path.join(__dirname, "..", "data", "Role_Access.xlsx");
    await workbook.xlsx.writeFile(filePath);
    res.download(filePath, "Role_Access.xlsx");
  } catch (err) {
    console.error('Export Excel error:', err);
    res.status(500).json({ error: 'Failed to export Excel' });
  }
});

module.exports = router;
