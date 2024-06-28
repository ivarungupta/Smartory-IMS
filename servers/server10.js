const http = require('http');
const oracledb = require('oracledb');
const ejs = require('ejs');
const fs = require('fs');
const bodyParser = require('body-parser');

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

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/submitInspection') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', async () => {
        const formData = new URLSearchParams(body);
        let connection;
        try {
          connection = await oracledb.getConnection(dbConfig);
        } catch (err) {
          console.error('Error connecting to Oracle database:', err);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error');
          return;
        }
        const maxIdResult = await connection.execute('SELECT MAX(INSPECTION_ID) AS max_id FROM INSPECTION');
        const maxId = maxIdResult.rows[0].MAX_ID;
        const newInspectionId = (maxId ? parseInt(maxId) + 1 : 1).toString().padStart(5, '0');

        const recno = formData.get('recno');
        const inspecdate = formData.get('inspecdate');
        const inspecres = formData.get('inspecres');
        const quantacc = formData.get('quantacc');
        const quantrej = formData.get('quantrej');
        const itemid = formData.get('itemid');

        const sql = `INSERT INTO INSPECTION 
                     (INSPECTION_ID, RECEIPT_NO, INSPECTION_DATE, INSPECTION_RESULT, QUANTITY_ACCEPT, QUANTITY_REJECT, ITEM_ID) 
                     VALUES (:newInspectionId, :recno, TO_DATE(:inspecdate, 'YYYY-MM-DD'), :inspecres, :quantacc, :quantrej, :itemid)`;

        const bindObject = {
          newInspectionId: newInspectionId,
          recno: recno,
          inspecdate: inspecdate,
          inspecres: inspecres,
          quantacc: quantacc,
          quantrej: quantrej,
          itemid: itemid
        };

        console.log('Form Data:', formData);
        console.log('SQL Statement:', sql);
        console.log('Bind Object:', bindObject);

        try {
          await connection.execute(sql, bindObject);
        } catch (err) {
          console.error('Error executing SQL statement:', err);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error');
          return;
        } finally {
          try {
            await connection.close();
          } catch (err) {
            console.error('Error closing Oracle connection:', err);
          }
        }
        res.writeHead(302, { 'Location': '/' });
        res.end();
      });
    } else if (req.method === 'GET' && /^\/edit\/\d+$/.test(req.url)) {
      const inspectionId = req.url.split('/').pop(); // Ensure inspectionId is defined here
      let connection;
      try {
        connection = await oracledb.getConnection(dbConfig);
        const result = await connection.execute(
          'SELECT INSPECTION_ID, RECEIPT_NO, INSPECTION_DATE, INSPECTION_RESULT, QUANTITY_ACCEPT, QUANTITY_REJECT, ITEM_ID FROM INSPECTION WHERE INSPECTION_ID = :inspectionId',
          [inspectionId]
        );
        if (result.rows.length === 1) {
          const template = fs.readFileSync('../views/inspection_edit.ejs', 'utf8');
          const renderedHtml = ejs.render(template, { row: result.rows[0] });
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(renderedHtml);
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Record not found');
        }
      } catch (err) {
        console.error('Error fetching data or rendering template:', err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      } finally {
        if (connection) {
          try {
            await connection.close();
          } catch (err) {
            console.error('Error closing Oracle connection:', err);
          }
        }
      }
    } else if (req.method === 'POST' && /^\/update\/\d+$/.test(req.url)) {
      const inspectionId = req.url.split('/').pop(); // Ensure inspectionId is defined here
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', async () => {
        const formData = new URLSearchParams(body);
        const recno = formData.get('recno');
        const inspecdate = formData.get('inspecdate');
        const inspecres = formData.get('inspecres');
        const quantacc = formData.get('quantacc');
        const quantrej = formData.get('quantrej');
        const itemid = formData.get('itemid');

        let connection;
        try {
          connection = await oracledb.getConnection(dbConfig);
          const sql = `UPDATE INSPECTION 
                       SET RECEIPT_NO = :recno, INSPECTION_DATE = TO_DATE(:inspecdate, 'YYYY-MM-DD'), INSPECTION_RESULT = :inspecres, QUANTITY_ACCEPT = :quantacc, QUANTITY_REJECT = :quantrej, ITEM_ID = :itemid
                       WHERE INSPECTION_ID = :inspectionId`;
          const bindObject = {
            inspectionId: { val: inspectionId },
            recno: { val: recno },
            inspecdate: { val: inspecdate },
            inspecres: { val: inspecres },
            quantacc: { val: quantacc },
            quantrej: { val: quantrej },
            itemid: { val: itemid }
          };
          
          await connection.execute(sql, bindObject);
          res.writeHead(302, { 'Location': '/' });
          res.end();
        } catch (err) {
          console.error('Error updating record:', err);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error');
        } finally {
          if (connection) {
            try {
              await connection.close();
            } catch (err) {
              console.error('Error closing Oracle connection:', err);
            }
          }
        }
      });
    } else {
      let connection;
      try {
        connection = await oracledb.getConnection(dbConfig);
        const result = await connection.execute('SELECT INSPECTION_ID, RECEIPT_NO, INSPECTION_DATE, INSPECTION_RESULT, QUANTITY_ACCEPT, QUANTITY_REJECT, ITEM_ID FROM INSPECTION');
        const template = fs.readFileSync('../views/inspection_table.ejs', 'utf8');
        const renderedHtml = ejs.render(template, { data: result.rows });
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(renderedHtml);
      } catch (err) {
        console.error('Error fetching data or rendering template:', err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      } finally {
        if (connection) {
          try {
            await connection.close();
          } catch (err) {
            console.error('Error closing Oracle connection:', err);
          }
        }
      }
    }
  } catch (err) {
    console.error('Uncaught error:', err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
});

const PORT = process.env.PORT || 3010;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
