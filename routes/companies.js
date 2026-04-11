// routes/companies.js - MySQL Version
const express = require('express');
const { getPool } = require('../db-mysql');
const { generateERPTablePDF } = require('../utils/pdfTemplate');

const router = express.Router();

// =====================================================
// COMPANIES CRUD OPERATIONS
// =====================================================

// GET all companies
router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [companies] = await pool.query(`
      SELECT id, name, address, policies, manager, spos, areas, 
             created_at, updated_at 
      FROM companies 
      ORDER BY id
    `);

    // For each company, get its products (aliased to camelCase for frontend)
    for (let company of companies) {
      const [products] = await pool.query(`
        SELECT 
          id,
          product_id   AS productId,
          product_name AS productName,
          product_type AS productType,
          group_name   AS \`group\`,
          trade_price  AS tradePrice,
          discount_customer AS discountCustomer,
          sales_tax    AS salesTax,
          discount_for_us AS discountForUs,
          batch,
          expiry_date  AS expiryDate,
          date_added   AS dateAdded
        FROM products
        WHERE company_id = ?
        ORDER BY id
      `, [company.id]);

      company.products = products;
    }

    res.json(companies);
  } catch (err) {
    console.error('Load companies error:', err);
    res.status(500).json({ error: 'Failed to load companies' });
  }
});

// GET single company by ID
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const pool = getPool();

    const [companies] = await pool.query(`
      SELECT id, name, address, policies, manager, spos, areas,
             created_at, updated_at
      FROM companies
      WHERE id = ?
    `, [id]);

    if (companies.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const company = companies[0];

    // Get products for this company (aliased to camelCase for frontend)
    const [products] = await pool.query(`
      SELECT 
        id,
        product_id   AS productId,
        product_name AS productName,
        product_type AS productType,
        group_name   AS \`group\`,
        trade_price  AS tradePrice,
        discount_customer AS discountCustomer,
        sales_tax    AS salesTax,
        discount_for_us AS discountForUs,
        batch,
        expiry_date  AS expiryDate,
        date_added   AS dateAdded
      FROM products
      WHERE company_id = ?
      ORDER BY id
    `, [id]);

    company.products = products;

    res.json(company);
  } catch (err) {
    console.error('Load company error:', err);
    res.status(500).json({ error: 'Failed to load company' });
  }
});

// POST - Create new company
router.post('/', async (req, res) => {
  try {
    const { name, address, policies, manager, spos, areas, products } = req.body || {};

    if (!name) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Insert company
      const [result] = await connection.query(`
        INSERT INTO companies (name, address, policies, manager, spos, areas)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [name.trim(), address || '', policies || '', manager || '', spos || '', areas || '']);

      const companyId = result.insertId;

      // Insert products if provided
      if (products && Array.isArray(products) && products.length > 0) {
        for (const product of products) {
          // Generate product ID if not provided
          let productId = product.productId;
          if (!productId || productId === '') {
            const [maxResult] = await connection.query(`
              SELECT MAX(CAST(SUBSTRING(product_id, 5) AS UNSIGNED)) as max_id
              FROM products
              WHERE product_id LIKE 'PRD-%'
            `);
            const maxId = maxResult[0].max_id || 0;
            productId = `PRD-${String(maxId + 1).padStart(6, '0')}`;
          }

          await connection.query(`
            INSERT INTO products (
              product_id, product_name, product_type, company_id, group_name,
              trade_price, discount_customer, sales_tax, discount_for_us,
              batch, expiry_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            productId,
            product.productName || '',
            product.productType || '',
            companyId,
            product.group || '',
            parseFloat(product.tradePrice || 0),
            parseFloat(product.discountCustomer || 0),
            parseFloat(product.salesTax || 0),
            parseFloat(product.discountForUs || 0),
            product.batch || '-',
            product.expiryDate || null
          ]);
        }
      }

      await connection.commit();

      // Fetch the created company with products
      const [newCompany] = await connection.query(`
        SELECT id, name, address, policies, manager, spos, areas,
               created_at, updated_at
        FROM companies
        WHERE id = ?
      `, [companyId]);

      const [newProducts] = await connection.query(`
        SELECT id, product_id, product_name, product_type, group_name,
               trade_price, discount_customer, sales_tax, discount_for_us,
               batch, expiry_date, date_added
        FROM products
        WHERE company_id = ?
      `, [companyId]);

      newCompany[0].products = newProducts;

      res.status(201).json(newCompany[0]);

    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

  } catch (err) {
    console.error('Create company error:', err);
    res.status(500).json({ error: 'Failed to create company' });
  }
});

// PUT - Update company
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, address, policies, manager, spos, areas, products } = req.body || {};

    if (!name) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Check if company exists
      const [existing] = await connection.query('SELECT id FROM companies WHERE id = ?', [id]);
      if (existing.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ error: 'Company not found' });
      }

      // Update company
      await connection.query(`
        UPDATE companies 
        SET name = ?, address = ?, policies = ?, manager = ?, spos = ?, areas = ?
        WHERE id = ?
      `, [name.trim(), address || '', policies || '', manager || '', spos || '', areas || '', id]);

      // Delete existing products and insert new ones
      await connection.query('DELETE FROM products WHERE company_id = ?', [id]);

      if (products && Array.isArray(products) && products.length > 0) {
        for (const product of products) {
          // Generate product ID if not provided
          let productId = product.productId;
          if (!productId || productId === '') {
            const [maxResult] = await connection.query(`
              SELECT MAX(CAST(SUBSTRING(product_id, 5) AS UNSIGNED)) as max_id
              FROM products
              WHERE product_id LIKE 'PRD-%'
            `);
            const maxId = maxResult[0].max_id || 0;
            productId = `PRD-${String(maxId + 1).padStart(6, '0')}`;
          }

          await connection.query(`
            INSERT INTO products (
              product_id, product_name, product_type, company_id, group_name,
              trade_price, discount_customer, sales_tax, discount_for_us,
              batch, expiry_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            productId,
            product.productName || '',
            product.productType || '',
            id,
            product.group || '',
            parseFloat(product.tradePrice || 0),
            parseFloat(product.discountCustomer || 0),
            parseFloat(product.salesTax || 0),
            parseFloat(product.discountForUs || 0),
            product.batch || '-',
            product.expiryDate || null
          ]);
        }
      }

      await connection.commit();

      // Fetch updated company with products
      const [updatedCompany] = await connection.query(`
        SELECT id, name, address, policies, manager, spos, areas,
               created_at, updated_at
        FROM companies
        WHERE id = ?
      `, [id]);

      const [updatedProducts] = await connection.query(`
        SELECT id, product_id, product_name, product_type, group_name,
               trade_price, discount_customer, sales_tax, discount_for_us,
               batch, expiry_date, date_added
        FROM products
        WHERE company_id = ?
      `, [id]);

      updatedCompany[0].products = updatedProducts;

      res.json(updatedCompany[0]);

    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

  } catch (err) {
    console.error('Update company error:', err);
    res.status(500).json({ error: 'Failed to update company' });
  }
});

// DELETE - Delete company
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const pool = getPool();

    const [result] = await pool.query('DELETE FROM companies WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Delete company error:', err);
    res.status(500).json({ error: 'Failed to delete company' });
  }
});

// =====================================================
// PRODUCTS OPERATIONS
// =====================================================

// Search products for Sale Booking (lightweight + best PO batch/expiry)
// GET /api/companies/products/search-booking?q=DEX&limit=20
router.get('/products/search-booking', async (req, res) => {
  try {
    const pool = getPool();
    const qRaw = String(req.query.q || '').trim();
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    if (!qRaw || qRaw.length < 2) {
      return res.json({ products: [] });
    }

    const q = `%${qRaw}%`;
    const [products] = await pool.query(
      `
      SELECT 
        p.id,
        p.product_id   AS productId,
        p.product_name AS productName,
        p.product_type AS productType,
        p.trade_price  AS tradePrice,
        p.discount_customer AS discountCustomer,
        p.sales_tax    AS salesTax,
        p.discount_for_us AS discountForUs,
        p.group_name   AS \`group\`,
        p.batch,
        p.expiry_date  AS expiryDate,
        c.name         AS vendorName,
        c.id           AS companyId
      FROM products p
      JOIN companies c ON p.company_id = c.id
      WHERE p.product_name LIKE ? OR p.product_id LIKE ? OR c.name LIKE ?
      ORDER BY p.product_name ASC
      LIMIT ?
      `,
      [q, q, q, limit]
    );

    // For each product, fetch best (earliest expiry) PO row that mentions the product name.
    // Note: PO items are stored as JSON string; we use LIKE for compatibility.
    const out = [];
    for (const p of products) {
      let bestPO = null;
      try {
        const [poRows] = await pool.query(
          `
          SELECT po_number AS poNumber, batch, expiry_date AS expiryDate
          FROM purchase_orders
          WHERE company_id = ?
            AND items LIKE ?
            AND expiry_date IS NOT NULL
          ORDER BY expiry_date ASC
          LIMIT 1
          `,
          [p.companyId, `%${String(p.productName || '').trim()}%`]
        );
        if (poRows && poRows.length) bestPO = poRows[0];
      } catch (e) {
        // Don't fail the whole search if PO lookup fails
        bestPO = null;
      }

      out.push({
        ...p,
        bestPO
      });
    }

    res.json({ products: out });
  } catch (err) {
    console.error('Search booking products error:', err);
    res.status(500).json({ error: 'Failed to search booking products' });
  }
});

// GET all products from all companies (for Purchase Reports)
router.get('/products/all', async (req, res) => {
  try {
    const pool = getPool();
    const { limit, offset, q } = req.query;

    const queryParams = [];
    let countParams = [];

    let baseSql = `
      FROM products p
      JOIN companies c ON p.company_id = c.id
    `;

    if (q) {
      const searchTerm = `%${q}%`;
      baseSql += ` WHERE p.product_name LIKE ? OR c.name LIKE ? OR p.product_id LIKE ?`;
      countParams = [searchTerm, searchTerm, searchTerm];
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    const [countResult] = await pool.query(`SELECT COUNT(*) as total ${baseSql}`, countParams);
    const total = countResult[0].total;

    let dataSql = `
      SELECT 
        p.id,
        p.product_id   AS productId,
        p.product_name AS productName,
        p.product_type AS productType,
        p.trade_price  AS tradePrice,
        p.discount_customer AS discountCustomer,
        p.sales_tax    AS salesTax,
        p.discount_for_us AS discountForUs,
        p.batch,
        p.expiry_date  AS expiryDate,
        p.date_added   AS dateAdded,
        c.name         AS vendorName,
        c.id           AS companyId
      ${baseSql}
      ORDER BY p.id DESC
    `;

    if (limit && offset !== undefined) {
      dataSql += ` LIMIT ? OFFSET ?`;
      queryParams.push(parseInt(limit), parseInt(offset));
    }

    const [products] = await pool.query(dataSql, queryParams);

    // If limits were requested, return {products, total} structure
    if (limit && offset !== undefined) {
      res.json({ products, total });
    } else {
      // Backwards compatible
      res.json(products);
    }
  } catch (err) {
    console.error('Load all products error:', err);
    res.status(500).json({ error: 'Failed to load products' });
  }
});

// GET single product by productId
router.get('/products/:productId', async (req, res) => {
  try {
    const productId = req.params.productId;
    const pool = getPool();

    const [products] = await pool.query(`
      SELECT 
        p.id, p.product_id, p.product_name, p.product_type,
        p.trade_price, p.discount_customer, p.sales_tax, p.discount_for_us,
        p.batch, p.expiry_date, p.date_added,
        c.name as vendorName, c.id as companyId
      FROM products p
      JOIN companies c ON p.company_id = c.id
      WHERE p.product_id = ?
    `, [productId]);

    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(products[0]);
  } catch (err) {
    console.error('Load single product error:', err);
    res.status(500).json({ error: 'Failed to load product' });
  }
});

// PUT - Update single product by productId
router.put('/products/:productId', async (req, res) => {
  try {
    const productId = req.params.productId;
    const { productName, productType, tradePrice, discountCustomer, salesTax, discountForUs, expiryDate } = req.body || {};

    const pool = getPool();

    const [result] = await pool.query(`
      UPDATE products
      SET product_name = COALESCE(?, product_name),
          product_type = COALESCE(?, product_type),
          trade_price = COALESCE(?, trade_price),
          discount_customer = COALESCE(?, discount_customer),
          sales_tax = COALESCE(?, sales_tax),
          discount_for_us = COALESCE(?, discount_for_us),
          expiry_date = COALESCE(?, expiry_date)
      WHERE product_id = ?
    `, [
      productName,
      productType,
      tradePrice !== undefined ? parseFloat(tradePrice) : null,
      discountCustomer !== undefined ? parseFloat(discountCustomer) : null,
      salesTax !== undefined ? parseFloat(salesTax) : null,
      discountForUs !== undefined ? parseFloat(discountForUs) : null,
      expiryDate || null,
      productId
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Fetch updated product
    const [products] = await pool.query(`
      SELECT 
        p.id, p.product_id, p.product_name, p.product_type,
        p.trade_price, p.discount_customer, p.sales_tax, p.discount_for_us,
        p.batch, p.expiry_date, p.date_added,
        c.name as vendorName, c.id as companyId
      FROM products p
      JOIN companies c ON p.company_id = c.id
      WHERE p.product_id = ?
    `, [productId]);

    res.json(products[0]);
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE - Delete single product by productId
router.delete('/products/:productId', async (req, res) => {
  try {
    const productId = req.params.productId;
    const pool = getPool();

    const [result] = await pool.query('DELETE FROM products WHERE product_id = ?', [productId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// =====================================================
// PDF EXPORT
// =====================================================

// GET /api/companies/export/details-pdf
router.get('/export/details-pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [companies] = await pool.query('SELECT * FROM companies ORDER BY id');
    res.json(companies);
  } catch (err) {
    console.error('Companies export details pdf error:', err);
    res.status(500).json({ error: 'Failed to generate companies details PDF' });
  }
});

// GET /api/companies/products/export/pdf - Purchase Reports PDF
router.get('/products/export/pdf', async (req, res) => {
  try {
    const pool = getPool();
    const [products] = await pool.query(`
      SELECT 
        p.product_id as productId,
        p.product_name as productName,
        p.product_type as productType,
        c.name as vendorName,
        p.trade_price as tradePrice,
        p.discount_customer as discountCustomer,
        p.sales_tax as salesTax,
        p.discount_for_us as discountForUs,
        DATE_FORMAT(p.date_added, '%Y-%m-%d') as dateAdded
      FROM products p
      JOIN companies c ON p.company_id = c.id
      ORDER BY p.id
    `);

    const columns = [
      { label: 'Product ID', key: 'productId', widthRatio: 1.0 },
      { label: 'Product Name', key: 'productName', widthRatio: 1.5, align: 'left' },
      { label: 'Product Type', key: 'productType', widthRatio: 1.0, align: 'left' },
      { label: 'Vendor Name', key: 'vendorName', widthRatio: 1.5, align: 'left' },
      { label: 'Trade Price', key: 'tradePrice', widthRatio: 0.8, align: 'right' },
      { label: 'Discount % (Cust)', key: 'discountCustomer', widthRatio: 0.9, align: 'right' },
      { label: 'Sales Tax %', key: 'salesTax', widthRatio: 0.8, align: 'right' },
      { label: 'Discount for Us %', key: 'discountForUs', widthRatio: 0.9, align: 'right' },
      { label: 'Date Added', key: 'dateAdded', widthRatio: 1.0 }
    ];

    generateERPTablePDF(
      res,
      products,
      columns,
      'Purchase Reports (Company Products)',
      'Purchase_Reports.pdf',
      {
        allowEmpty: true,
        emptyMessage: 'No products found for purchase reports.'
      }
    );
  } catch (err) {
    console.error('Purchase reports export pdf error:', err);
    res.status(500).json({ error: 'Failed to generate purchase reports PDF' });
  }
});

module.exports = router;
