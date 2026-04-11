// utils/pdfTemplate.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generate a standardized ERP PDF document with aligned columns and ERP header/footer.
 * Supports multiple sections, header metadata, summary lines, and graceful empty states.
 *
 * @param {Object} res - Express response object
 * @param {Array} data - Array of records to print (legacy single-section mode)
 * @param {Array} columns - [{label, key, widthRatio}]
 * @param {String} title - PDF Title shown at top
 * @param {String} fileName - Output file name
 * @param {Object} options - Optional configuration
 */
function generateERPTablePDF(
  res,
  data,
  columns,
  title,
  fileName = 'report.pdf',
  options = {}
) {
  try {
    const {
      headerLines = [],
      footerLines = [
        'Faizan Medicine Company',
        'House No CB-81/1, Iqbal Road Supply Mansehra Road (Abbottabad)',
        'Phone: +92 3028225831 , +92 3127000265',
        'Email: fezanmc@gmail.com , fezanmc@yahoo.com',
        'Thank you for your business'
      ],
      sections = [],
      allowEmpty = false,
      emptyMessage = 'No records found'
    } = options || {};

    const resolvedSections = Array.isArray(sections) && sections.length
      ? sections
      : [{
        title: options.sectionTitle || null,
        columns,
        data,
        allowEmpty: options.allowEmpty ?? allowEmpty,
        emptyMessage: options.emptyMessage || emptyMessage,
        summaryLines: options.summaryLines || [],
        rowFormatter: options.rowFormatter || null
      }];

    const hasAnyData = resolvedSections.some(section => {
      const rows = Array.isArray(section.data) ? section.data : [];
      return rows.length > 0;
    });

    if (!hasAnyData && !allowEmpty && !resolvedSections.some(s => s.allowEmpty)) {
      return res.status(404).json({ error: 'No records found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

    const layout = options.layout || 'portrait';
    const margin = (options.margin !== undefined) ? options.margin : 80;
    const FOOTER_BAND_HEIGHT = options.footerHeight || 260; // reserved space for footer/warranty
    const doc = new PDFDocument({ margin: margin, size: 'A4', layout: layout });
    doc.pipe(res);

    // ===== HEADER =====
    const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
    if (fs.existsSync(logoPath)) doc.image(logoPath, 60, 10, { width: 100 });

    doc.moveDown(2);
    doc.fontSize(16).font('Helvetica-Bold').text(title, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').text(`Generated on: ${new Date().toLocaleString()}`, { align: 'left' });

    if (headerLines.length) {
      doc.moveDown(0.6);
      doc.fontSize(11).font('Helvetica');
      headerLines.forEach(line => {
        if (!line || typeof line !== 'object') return;
        const label = line.label ? `${line.label}: ` : '';
        doc.text(`${label}${line.value ?? ''}`);
      });
    }
    doc.moveDown(1);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const contentWidth = right - left;

    const TABLE = {
      headerFill: '#e6f4ea',
      headerLine: '#04792d',
      grid: '#d9d9d9',
      rowAltFill: '#fafafa',
      text: '#000000'
    };

    const renderSection = (section) => {
      const allowSectionEmpty = section.allowEmpty ?? allowEmpty;
      if (section.title) {
        doc.font('Helvetica-Bold').fontSize(12).text(section.title, { align: 'left' });
        doc.moveDown(0.4);
      }

      if (section.headerLines && section.headerLines.length) {
        doc.fontSize(10).font('Helvetica');
        section.headerLines.forEach(line => {
          const label = line.label ? `${line.label}: ` : '';
          doc.text(`${label}${line.value ?? ''}`);
        });
        doc.moveDown(0.6);
      }

      const cols = Array.isArray(section.columns) && section.columns.length ? section.columns : columns;
      if (!cols || !cols.length) {
        doc.font('Helvetica').text('No column configuration provided.', { align: 'center' });
        doc.moveDown(1);
        return;
      }

      const rawRows = Array.isArray(section.data) ? section.data : [];
      const rows = section.rowFormatter ? rawRows.map(section.rowFormatter) : rawRows;
      if (!rows.length) {
        const message = section.emptyMessage || emptyMessage;
        if (!allowSectionEmpty) {
          doc.font('Helvetica-Oblique').fontSize(10).fillColor('#666').text(message, { align: 'center' });
          doc.moveDown(1);
          doc.fillColor('black');
          return;
        }
        doc.font('Helvetica-Oblique').fontSize(10).fillColor('#666').text(message, { align: 'center' });
        doc.moveDown(1);
        doc.fillColor('black');
        return;
      }

      const totalRatio = cols.reduce((sum, col) => sum + (col.widthRatio || 1), 0);
      // Column width strategy:
      // - Start from ratios for flexible sizing
      // - If a column is marked noWrap (or has minWidth), measure max string width and reserve enough space
      // - Give leftover width to other columns proportionally
      const padding = 5;
      const innerPad = padding * 2 + 6; // left/right + a little breathing room

      const headerFontSize = section.headerFontSize || options.headerFontSize || (cols.length >= 9 ? 9 : 10);
      const bodyFontSize = section.bodyFontSize || options.bodyFontSize || (cols.length >= 9 ? 9 : 10);

      // Measure widths for noWrap columns using body font size (numbers should not wrap)
      doc.font('Helvetica').fontSize(bodyFontSize);
      const measuredMin = cols.map((col) => {
        const explicitMin = Number(col.minWidth);
        let w = Number.isFinite(explicitMin) ? explicitMin : 0;

        // Always consider header label too
        try {
          const headerW = doc.widthOfString(String(col.label || '')) + innerPad;
          if (headerW > w) w = headerW;
        } catch (e) {}

        const shouldMeasure = !!col.noWrap || Number.isFinite(explicitMin);
        if (!shouldMeasure) return w;

        // Measure widest value in this column (cap to first 250 rows for performance)
        const sample = rows.slice(0, 250);
        for (const r of sample) {
          const raw = r[col.key];
          const v = (raw !== undefined && raw !== null && raw !== '') ? String(raw) : '-';
          try {
            const vw = doc.widthOfString(v) + innerPad;
            if (vw > w) w = vw;
          } catch (e) {}
        }
        return w;
      });

      // Baseline widths from ratios
      const baseWidths = cols.map(col => {
        const ratio = col.widthRatio || 1;
        return Math.floor((ratio / totalRatio) * contentWidth);
      });

      // Reserve measured mins first
      const reserved = baseWidths.map((bw, i) => Math.max(bw, measuredMin[i] || 0));
      let reservedSum = reserved.reduce((a, b) => a + b, 0);

      // If reserved exceeds available width, shrink flexible columns and font slightly via caller settings
      // Here we do a simple proportional shrink, but never go below a small minimum.
      if (reservedSum > contentWidth) {
        const minFloor = cols.map(col => Math.max(30, Number(col.minWidth) || 0));
        // Start from reserved and shrink columns that are above their floor
        let over = reservedSum - contentWidth;
        // Multiple passes to shrink gradually
        for (let pass = 0; pass < 6 && over > 0; pass++) {
          let shrinkableTotal = 0;
          reserved.forEach((w, i) => {
            const can = Math.max(0, w - minFloor[i]);
            shrinkableTotal += can;
          });
          if (shrinkableTotal <= 0) break;
          reserved.forEach((w, i) => {
            if (over <= 0) return;
            const can = Math.max(0, w - minFloor[i]);
            if (can <= 0) return;
            const take = Math.min(can, Math.ceil((can / shrinkableTotal) * over));
            reserved[i] = w - take;
            over -= take;
          });
        }
        reservedSum = reserved.reduce((a, b) => a + b, 0);
      }

      // Fix rounding drift by adjusting last column
      if (reservedSum !== contentWidth) {
        reserved[reserved.length - 1] += (contentWidth - reservedSum);
      }

      const colWidths = reserved;

      let y = doc.y;
      const headerHeight = 20;
      // Header background band
      doc.save();
      doc.rect(left, y - 2, contentWidth, headerHeight + 4).fill(TABLE.headerFill);
      doc.restore();

      doc.font('Helvetica-Bold').fontSize(headerFontSize).fillColor(TABLE.text);
      let x = left;
      cols.forEach((col, i) => {
        const noWrap = !!col.noWrap;
        doc.text(col.label, x + 4, y + 2, {
          width: colWidths[i] - 8,
          align: col.align || 'center',
          lineBreak: !noWrap,
          ellipsis: noWrap
        });
        x += colWidths[i];
      });

      // Header bottom line + vertical grid for header
      y += headerHeight;
      doc.moveTo(left, y).lineTo(right, y).strokeColor(TABLE.headerLine).lineWidth(1).stroke();
      let gridX = left;
      doc.strokeColor(TABLE.grid).lineWidth(0.7);
      cols.forEach((_, i) => {
        if (i === 0) return;
        gridX += colWidths[i - 1];
        doc.moveTo(gridX, y - headerHeight).lineTo(gridX, y).stroke();
      });
      y += 6;

      doc.font('Helvetica').fontSize(bodyFontSize).fillColor(TABLE.text);

      rows.forEach(row => {
        let maxRowHeight = 0;

        // Calculate the maximum height required for the current row
        cols.forEach((col, i) => {
          const rawValue = row[col.key];
          const value = (rawValue !== undefined && rawValue !== null && rawValue !== '') ? rawValue.toString() : '-';
          const noWrap = !!col.noWrap;
          const cellHeight = doc.heightOfString(value, {
            width: colWidths[i] - (padding * 2),
            lineBreak: !noWrap
          });
          if (cellHeight > maxRowHeight) {
            maxRowHeight = cellHeight;
          }
        });

        const rowHeight = maxRowHeight + (padding * 2);

        // Check for page break before drawing the row, keeping footer band clear
        if (y + rowHeight > doc.page.height - doc.page.margins.bottom - FOOTER_BAND_HEIGHT) {
          doc.addPage();
          y = doc.page.margins.top;
          // Redraw header on new page (same styling)
          doc.save();
          doc.rect(left, y - 2, contentWidth, headerHeight + 4).fill(TABLE.headerFill);
          doc.restore();

          doc.font('Helvetica-Bold').fontSize(headerFontSize).fillColor(TABLE.text);
          let headerX = left;
          cols.forEach((col, i) => {
            const noWrap = !!col.noWrap;
            doc.text(col.label, headerX + 4, y + 2, {
              width: colWidths[i] - 8,
              align: col.align || 'center',
              lineBreak: !noWrap,
              ellipsis: noWrap
            });
            headerX += colWidths[i];
          });

          y += headerHeight;
          doc.moveTo(left, y).lineTo(right, y).strokeColor(TABLE.headerLine).lineWidth(1).stroke();
          let headerGridX = left;
          doc.strokeColor(TABLE.grid).lineWidth(0.7);
          cols.forEach((_, i) => {
            if (i === 0) return;
            headerGridX += colWidths[i - 1];
            doc.moveTo(headerGridX, y - headerHeight).lineTo(headerGridX, y).stroke();
          });
          y += 6;

          doc.font('Helvetica').fontSize(bodyFontSize).fillColor(TABLE.text);
        }

        // Alternate row fill
        if ((rows.indexOf(row) % 2) === 1) {
          doc.save();
          doc.rect(left, y, contentWidth, rowHeight).fill(TABLE.rowAltFill);
          doc.restore();
        }

        // Draw the cell content + grid
        let x = left;
        cols.forEach((col, i) => {
          const rawValue = row[col.key];
          const value = (rawValue !== undefined && rawValue !== null && rawValue !== '') ? rawValue.toString() : '-';
          const noWrap = !!col.noWrap;
          doc.text(value, x + padding, y + padding, {
            width: colWidths[i] - (padding * 2),
            align: col.align || 'center',
            lineBreak: !noWrap,
            ellipsis: noWrap
          });
          // Cell border
          doc.rect(x, y, colWidths[i], rowHeight).strokeColor(TABLE.grid).lineWidth(0.7).stroke();
          x += colWidths[i];
        });

        y += rowHeight;
      });

      // Keep PDF cursor in sync with manual y positioning
      doc.y = y;

      if (section.summaryLines && section.summaryLines.length) {
        doc.moveDown(0.6);
        doc.font('Helvetica-Bold').fontSize(10);
        section.summaryLines.forEach(line => {
          const text = line.label ? `${line.label}: ${line.value ?? ''}` : (line.value ?? '');
          doc.text(text, left, doc.y, { width: contentWidth, align: line.align || 'right' });
          doc.moveDown(0.2);
        });
      }

      doc.moveDown(1);
    };

    resolvedSections.forEach((section, index) => {
      if (index > 0) {
        doc.addPage();
      }
      renderSection(section);
    });

    // ===== FOOTER =====
    // Reserve a fixed footer band so we never trigger a new page
    const pageH = doc.page.height;
    const marginBottom = doc.page.margins.bottom;
    const footerBandHeight = FOOTER_BAND_HEIGHT;
    const footerTopY = pageH - marginBottom - footerBandHeight;

    // Draw a subtle separator line above footer band
    doc.moveTo(left, footerTopY - 6).lineTo(right, footerTopY - 6).strokeColor('#e6e6e6').stroke();

    // Company standard footer lines (centered)
    doc.fontSize(9).fillColor('#666');
    footerLines.forEach((line, i) => {
      doc.text(line, left, footerTopY + i * 12, { width: contentWidth, align: 'center' });
    });

    // Warranty block (small font, left aligned, wrapped inside footer band)
    const warrantyTitle = 'Warranty:';
    const warrantyLines = [
      'Form 2A (See Rules (19 & 30)) Warranty Under Section 23(1)(i) Of The Drugs Act, 1976',
      'I Zeeshan khan Abbasi being a person resident in Pakistan, carrying on business at Janjua Street Supply Abbottabad under the name of FEZAN MEDICINE COMPANY-ABBOTTABAD, do hereby give this warranty that the drugs here above described as sold by me/specified and contained in the bill of sale, invoice, bill of lading or other document describing the goods referred to herein do not contravene in any way the provisions of section 23 of the Drugs Act, 1976.',
      '',
      'Form 11 [See Rule 10(3)] Warranty Under Alternative Medicines & Health Products (Enlistment) Rules, 2014',
      'It is hereby certified and I Zeshan Khan Abbasi undertake that above mentioned finished products of specified batch number (or lot number) supplied by me do not contravene any provision of DRAP Act, 2012 and rules framed there under.',
      '',
      'NOTE:',
      '1- For near expiry products we must be informed six months prior to expiry.',
      '2- Ensure that you have received the stock according to mentioned quantities and values in this invoice.',
      "3- In case of any discrepancy, breakage & leakage please inform us immediately otherwise we don't accept any responsibility afterward."
    ];

    const warrantyX = left;
    let warrantyY = footerTopY + (footerLines.length ? (footerLines.length * 12 + 6) : 6) + 12; // nudge warranty block slightly down
    const warrantyMaxY = pageH - marginBottom - 36; // keep bottom padding
    const warrantyHeightBudget = Math.max(0, warrantyMaxY - warrantyY);

    // Render title
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#333');
    doc.text(warrantyTitle, warrantyX, warrantyY, { width: contentWidth * 0.68, align: 'left' });
    warrantyY = doc.y + 2;

    // Render paragraphs in tiny font with tight leading; clip within budget
    doc.font('Helvetica').fontSize(6.5).fillColor('#444');
    for (const line of warrantyLines) {
      if (doc.y > warrantyMaxY) break; // do not spill to new page
      doc.text(line, warrantyX, doc.y, { width: contentWidth * 0.68, align: 'left' });
    }
    // Capture the vertical end of the warranty block to align credits bottom to it
    const warrantyEndY = Math.min(doc.y, warrantyMaxY);

    // Software credits (bottom-right corner)
    const creditsBrand = 'Software Developed by: Auxwork PVT LTD';
    const creditsLines = [
      'auxwork.com, support@auxwork.com',
      '+923219985472'
    ];
    const baseFont = 'Helvetica-Oblique';
    const baseSize = 7.5;
    doc.font(baseFont).fontSize(baseSize).fillColor('#666');
    const creditsWidth = contentWidth * 0.32; // width allotted for credits block
    const creditsX = left + contentWidth - creditsWidth;

    // Dynamically shrink brand line font so it stays on one line
    let brandSize = baseSize;
    let brandWidth = doc.widthOfString(creditsBrand);
    while (brandWidth > creditsWidth && brandSize > 6) {
      brandSize -= 0.2;
      doc.fontSize(brandSize);
      brandWidth = doc.widthOfString(creditsBrand);
    }

    // Measure heights using final sizes
    const brandHeight = doc.currentLineHeight();
    doc.fontSize(baseSize); // reset for the remaining lines
    const otherHeights = creditsLines.map(l => doc.heightOfString(l, { width: creditsWidth, align: 'right' }));
    const creditsGap = 2;
    const creditsTotalHeight = brandHeight + otherHeights.reduce((a, b) => a + b, 0) + creditsGap * (creditsLines.length);

    const minY = footerTopY + (footerLines.length ? (footerLines.length * 12 + 6) : 6) + 2;
    const maxTopY = pageH - marginBottom - creditsTotalHeight - 2; // allow slightly lower placement
    // Position credits just below the warranty block with a larger visual gap
    const gapBelowWarranty = 30;
    let creditsStartY = warrantyEndY + gapBelowWarranty;
    if (creditsStartY < minY) creditsStartY = minY;
    if (creditsStartY > maxTopY) creditsStartY = maxTopY;

    // Render brand line with adjusted font size, no wrapping
    doc.font(baseFont).fontSize(brandSize);
    let lineY = creditsStartY;
    const brandTextWidth = doc.widthOfString(creditsBrand);
    const brandTextX = creditsX + (creditsWidth - brandTextWidth); // right align without width, prevents wrapping
    doc.text(creditsBrand, brandTextX, lineY, { align: 'left' });
    lineY += brandHeight + creditsGap;

    // Render remaining lines
    doc.font(baseFont).fontSize(baseSize);
    creditsLines.forEach((line, idx) => {
      const h = otherHeights[idx];
      doc.text(line, creditsX, lineY, { width: creditsWidth, align: 'right' });
      lineY += h + creditsGap;
    });

    doc.end();
  } catch (err) {
    console.error('PDF Generation Error:', err);
    if (!res.headersSent)
      res.status(500).json({ error: 'Failed to generate PDF report' });
  }
}

module.exports = { generateERPTablePDF };
