
const express = require('express');
const bodyParser = require('body-parser');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

// Serve the HTML form
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../qr/qr_2.html'));
});

app.post('/submitItem', async (req, res) => {
  const { itemid, itemname, itemuom, itemreord, itemquant } = req.body;

  // Generate QR Code
  const qrText = ` ${itemid} ${itemname} ${itemuom} ${itemreord} ${itemquant}`;
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

const PORT = 3012;
app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
});