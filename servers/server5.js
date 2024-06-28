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
    if (req.method === 'POST' && req.url === '/submitMisc') {
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
        const maxIdResult = await connection.execute('SELECT MAX(TRANSACTION_ID) AS max_id FROM MISC_MATERIAL_TRANSACTION');
        const maxId = maxIdResult.rows[0].MAX_ID;
        const newTransId = (maxId ? parseInt(maxId) + 1 : 1).toString().padStart(5, '0');

        const transvalue = formData.get('transvalue');
        const transdate = formData.get('transdate');
        const itemid = formData.get('itemid');
        const transquant = formData.get('transquant');

        const sql = `INSERT INTO MISC_MATERIAL_TRANSACTION 
                     (TRANSACTION_ID, TRANSACTION_VALUE, TRANSACTION_DATE, ITEM_ID, TRANSACTION_QUANTITY) 
                     VALUES (:newTransId, :transvalue, TO_DATE(:transdate, 'YYYY-MM-DD'), :itemid, :transquant)`;

        const bindObject = {
          newTransId: { val: newTransId },
          transvalue: { val: transvalue },
          transdate: { val: transdate },
          itemid: { val: itemid },
          transquant: { val: transquant }
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
      const transactionId = req.url.split('/').pop(); // Ensure transactionId is defined here
      let connection;
      try {
        connection = await oracledb.getConnection(dbConfig);
        const result = await connection.execute(
          'SELECT TRANSACTION_ID, TRANSACTION_VALUE, TRANSACTION_DATE, ITEM_ID, TRANSACTION_QUANTITY FROM MISC_MATERIAL_TRANSACTION WHERE TRANSACTION_ID = :transactionId',
          [transactionId]
        );
        if (result.rows.length === 1) {
          const template = fs.readFileSync('../views/misc_edit.ejs', 'utf8');
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
      const transactionId = req.url.split('/').pop(); // Ensure transactionId is defined here
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', async () => {
        const formData = new URLSearchParams(body);
        const transvalue = formData.get('transvalue');
        const transdate = formData.get('transdate');
        const itemid = formData.get('itemid');
        const transquant = formData.get('transquant');

        let connection;
        try {
          connection = await oracledb.getConnection(dbConfig);
          const sql = `UPDATE MISC_MATERIAL_TRANSACTION 
                       SET TRANSACTION_VALUE = :transvalue, TRANSACTION_DATE = TO_DATE(:transdate, 'YYYY-MM-DD'), 
                           ITEM_ID = :itemid, TRANSACTION_QUANTITY = :transquant 
                       WHERE TRANSACTION_ID = :transactionId`;
          const bindObject = {
            transactionId: { val: transactionId },
            transvalue: { val: transvalue },
            transdate: { val: transdate },
            itemid: { val: itemid },
            transquant: { val: transquant }
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
        const result = await connection.execute('SELECT TRANSACTION_ID, TRANSACTION_VALUE, TRANSACTION_DATE, ITEM_ID, TRANSACTION_QUANTITY FROM MISC_MATERIAL_TRANSACTION');
        const template = fs.readFileSync('../views/misc_table.ejs', 'utf8');
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

const PORT = process.env.PORT || 3005;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
