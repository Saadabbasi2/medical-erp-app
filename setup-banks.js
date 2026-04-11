require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'medical_erp',
    port: process.env.DB_PORT || 3306,
  });

  // Create table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS banks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      bank_id VARCHAR(20),
      bank_name VARCHAR(200),
      account_no VARCHAR(100),
      branch VARCHAR(100),
      coa_id VARCHAR(50),
      account_title VARCHAR(200),
      account_type VARCHAR(50),
      opening_date DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ banks table ready');

  // Seed data from SSMS screenshot
  const rows = [
    ['0001','HBL','02817900468503','','01010201','','','2020-01-04'],
    ['0002','HBL','02817900889003','0281','01010202','','','2022-11-01'],
    ['0003','BANK AL HABIB LIMITED','5541004100174601','IBB MANSEHRA ROAD','01010203','','','2022-11-01'],
    ['0004','ZEBA & HAROON','','0281','01010204','','','2025-06-12'],
    ['0005','AL HABIB WALEED','5541008100298901','23','01010205','','','2018-09-24'],
    ['0006','HABIB METRO BAZAR','06-59-74-23310-714-0112655','','01010206','','','2025-11-06'],
    ['0007','HABIB BANK LIMITED','04167951997903','','01010207','','','2024-12-12'],
    ['0008','JS BANK','9033000002672082','9033','01010208','','','2025-02-07'],
    ['0009','FAYSAL BANK','3419786000005480','','01010209','','','2025-03-12'],
    ['0010','FAYSAL BANK LIMITED','3419787000005652','','01010210','','','2025-03-12'],
  ];

  let inserted = 0;
  for (const r of rows) {
    const [ex] = await pool.query('SELECT id FROM banks WHERE bank_id=?', [r[0]]);
    if (!ex.length) {
      await pool.query(
        'INSERT INTO banks (bank_id,bank_name,account_no,branch,coa_id,account_title,account_type,opening_date) VALUES (?,?,?,?,?,?,?,?)',
        r
      );
      inserted++;
    }
  }
  console.log(`✅ Inserted ${inserted} banks`);
  await pool.end();
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
