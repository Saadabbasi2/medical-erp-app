// pdfHelper.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function createPdf(res, title, contentCallback) {
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);

  // 🟢 Add Logo (if exists)
  const logoPath = path.join(__dirname, 'assets', 'logo.png');
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 220, 20, { width: 120 });
    doc.moveDown(4);
  }

  // 🟢 Company Info
//   doc.fontSize(18).text('Faizan Medicine Company', { align: 'center' });
//   doc.fontSize(12).text('Supply (Abbottabad)', { align: 'center' });
//   doc.moveDown(2);

  // 🟢 Report Title
  doc.fontSize(16).text(title, { align: 'center', underline: true });
  doc.moveDown();

  // 🟢 Custom content from callback
  contentCallback(doc);

  // ---------------- Footer ----------------
doc.moveDown(6); // push footer near bottom

// draw a separator line
doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('gray').stroke();
doc.moveDown(1);

doc.fontSize(10).fillColor('gray');

// Company Info (centered, line by line)
doc.text('Faizan Medicine Company', { align: 'center' });
doc.text('House No CB-81/1, Iqbal Road Supply Mansehra Road (Abbottabad)', { align: 'center' });
doc.text('Phone: +92 3028225831 , +92 3127000265', { align: 'center' });
doc.text('Email: fezanmc@gmail.com , fezanmc@yahoo.com', { align: 'center' });

doc.moveDown(1);
doc.font('Helvetica-Bold').fillColor('black');
doc.text('Thank you for your business!', { align: 'center' });



  doc.end();
}



module.exports = createPdf;
