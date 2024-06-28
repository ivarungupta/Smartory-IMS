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

const isValidDate = (dateString) => {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  return regex.test(dateString);
};

const formatDateForOracle = (dateString) => {
  if (!dateString) return null;
  const [year, month, day] = dateString.split('-');
  return `TO_DATE('${year}-${month}-${day}', 'YYYY-MM-DD')`;
};

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/submitReceiving') {
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
        const maxIdResult = await connection.execute('SELECT MAX(ORDER_ID) AS max_id FROM RECEIVING_ORDER_DATA');
        const maxId = maxIdResult.rows[0].MAX_ID;
        const newReceivingId = (maxId ? parseInt(maxId) + 1 : 1).toString().padStart(5, '0');

        const recno = formData.get('recno');
        const recdate = formData.get('recdate');
        const recquant = formData.get('recquant');
        const revdate = formData.get('revdate');
        const revquant = formData.get('revquant');
        const suppid = formData.get('suppid');
        const itemid = formData.get('itemid');

        const sql = `INSERT INTO RECEIVING_ORDER_DATA 
                     (ORDER_ID, RECEIPT_NO, RECEIPT_DATE, RECEIPT_QUANTITY, RECEIVED_DATE, RECEIVED_QUANTITY, SUPPLIER_ID, ITEM_ID) 
                     VALUES (:newReceivingId, :recno, :recdate, :recquant, :revdate, :revquant, :suppid, :itemid)`;

        const bindObject = {
          newReceivingId: { val: newReceivingId },
          recno: { val: recno },
          recdate: { val: recdate },
          recquant: { val: recquant },
          revdate: { val: revdate },
          revquant: { val: revquant },
          suppid: { val: suppid },
          itemid: { val: itemid }
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
      const receivingId = req.url.split('/').pop();
      let connection;
      try {
        connection = await oracledb.getConnection(dbConfig);
        const result = await connection.execute(
          `SELECT ORDER_ID, RECEIPT_NO, 
                  TO_CHAR(RECEIPT_DATE, 'YYYY-MM-DD') AS RECEIPT_DATE, 
                  RECEIPT_QUANTITY, 
                  TO_CHAR(RECEIVED_DATE, 'YYYY-MM-DD') AS RECEIVED_DATE, 
                  RECEIVED_QUANTITY, SUPPLIER_ID, ITEM_ID 
           FROM RECEIVING_ORDER_DATA 
           WHERE ORDER_ID = :receivingId`,
          [receivingId]
        );
        if (result.rows.length === 1) {
          const template = fs.readFileSync('../views/receiving_edit.ejs', 'utf8');
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
      const receivingId = req.url.split('/').pop();
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', async () => {
        const formData = new URLSearchParams(body);
        const recno = formData.get('recno');
        const recdate = formData.get('recdate');
        const recquant = formData.get('recquant');
        const revdate = formData.get('revdate');
        const revquant = formData.get('revquant');
        const suppid = formData.get('suppid');
        const itemid = formData.get('itemid');

        console.log('Updating record:');
        console.log('receivingId:', receivingId, '(type:', typeof receivingId, ')');
        console.log('recno:', recno, '(type:', typeof recno, ')');
        console.log('recdate:', recdate, '(type:', typeof recdate, ')');
        console.log('recquant:', recquant, '(type:', typeof recquant, ')');
        console.log('revdate:', revdate, '(type:', typeof revdate, ')');
        console.log('revquant:', revquant, '(type:', typeof revquant, ')');
        console.log('suppid:', suppid, '(type:', typeof suppid, ')');
        console.log('itemid:', itemid, '(type:', typeof itemid, ')');

        if (!isValidDate(recdate) || !isValidDate(revdate)) {
          console.error('Invalid date format. recdate:', recdate, ', revdate:', revdate);
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Bad Request: Invalid date format');
          return;
        }

        let connection;
        try {
          connection = await oracledb.getConnection(dbConfig);
          const sql = `UPDATE RECEIVING_ORDER_DATA 
                       SET RECEIPT_NO = :recno, 
                           RECEIPT_DATE = ${formatDateForOracle(recdate)}, 
                           RECEIPT_QUANTITY = :recquant, 
                           RECEIVED_DATE = ${formatDateForOracle(revdate)}, 
                           RECEIVED_QUANTITY = :revquant, 
                           SUPPLIER_ID = :suppid, 
                           ITEM_ID = :itemid
                       WHERE ORDER_ID = :receivingId`;
          
          const bindObject = {
            receivingId: { val: receivingId },
            recno: { val: recno },
            recquant: { val: recquant },
            revquant: { val: revquant },
            suppid: { val: suppid },
            itemid: { val: itemid }
          };

          console.log('SQL:', sql);
          console.log('Bind Object:', JSON.stringify(bindObject, null, 2));

          try {
            await connection.execute(sql, bindObject);
            res.writeHead(302, { 'Location': '/' });
            res.end();
          } catch (err) {
            console.error('Error updating record:', err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
          }
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
        const result = await connection.execute(`
          SELECT ORDER_ID, RECEIPT_NO, 
                 TO_CHAR(RECEIPT_DATE, 'YYYY-MM-DD') AS RECEIPT_DATE, 
                 RECEIPT_QUANTITY, 
                 TO_CHAR(RECEIVED_DATE, 'YYYY-MM-DD') AS RECEIVED_DATE, 
                 RECEIVED_QUANTITY, SUPPLIER_ID, ITEM_ID 
          FROM RECEIVING_ORDER_DATA
        `);
        const template = fs.readFileSync('../views/receiving_table.ejs', 'utf8');
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

const PORT = process.env.PORT || 3007;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});