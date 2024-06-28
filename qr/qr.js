
const express = require('express');
const bodyParser = require('body-parser');
const oracledb = require('oracledb');
const QRCode = require('qrcode');
const path = require('path');

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.extendedMetaData = true;
oracledb.enableQueryMode = true;
oracledb.autoCommit = true;
oracledb.initOracleClient({ libDir: 'C:\\oraclexe\\instantclient_11_2' });

const dbConfig = {
  user: 'inventory',
  password: 'Oracle1',
  connectString: '(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=localhost)(PORT=1521))(CONNECT_DATA=(SERVICE_NAME=xe)))'
};

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

// Serve the HTML form
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../qr/qr.html'));
});

app.post('/submitItem', async (req, res) => {
  const { itemid, itemname, itemuom, itemreord, itemquant } = req.body;

  // Generate QR Code
  const qrText = `Item ID: ${itemid}, Item Name: ${itemname}, UOM: ${itemuom}, Reordering: ${itemreord}, Item Quantity: ${itemquant}`;
  let qrCodeDataUrl;
  try {
    qrCodeDataUrl = await QRCode.toDataURL(qrText);
  } catch (err) {
    console.error('Error generating QR code', err);
    res.status(500).send('Error generating QR code');
    return;
  }

  // Convert Data URL to Binary
  const base64Data = qrCodeDataUrl.split(',')[1];
  const qrCodeBuffer = Buffer.from(base64Data, 'base64');

  // Store data in the database
  try {
    const connection = await oracledb.getConnection(dbConfig);
    await connection.execute(
      `INSERT INTO ITEM_MASTER (ITEM_ID, ITEM_NAME, UOM, REORDERING, ITEM_QUANTITY, QR) VALUES (:itemid, :itemname, :itemuom, :itemreord, :itemquant, :qr)`,
      { itemid, itemname, itemuom, itemreord, itemquant, qr: qrCodeBuffer }
    );
    await connection.close();
  } catch (err) {
    console.error('Database error', err);
    res.status(500).send('Database error');
    return;
  }

  // Respond with the QR code image and download link
  res.send(`
    <div style="text-align: center;">
      <img src="${qrCodeDataUrl}" alt="QR Code" />
      <br>
      <a class="btn btn-primary" role="button" href="${qrCodeDataUrl}" download="ims_qr_code.png">Download QR Code</a>
      <br>
      <a href="/">Back to Form</a>
    </div>
  `);
});

const PORT = 3011;
app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
});