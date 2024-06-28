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
    if (req.method === 'POST' && req.url === '/submitSale') {
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
        const maxIdResult = await connection.execute('SELECT MAX(TRANSACTION_ID) AS max_id FROM SALE_TRANSACTION');
        const maxId = maxIdResult.rows[0].MAX_ID;
        const newSaleId = (maxId ? parseInt(maxId) + 1 : 1).toString().padStart(5, '0');

        const cusid = formData.get('cusid');
        const itemid = formData.get('itemid');
        const transdate = formData.get('transdate');
        const quantsold = formData.get('quantsold');
        const rate = formData.get('rate');
        const tax = formData.get('tax');
        const totamt = formData.get('totamt');

        const sql = `INSERT INTO SALE_TRANSACTION 
                     (TRANSACTION_ID, CUSTOMER_ID, ITEM_ID, TRANSACTION_DATE, QUANTITY_SOLD, RATE, TAX, TOTAL_AMOUNT) 
                     VALUES (:newSaleId, :cusid, :itemid, TO_DATE(:transdate, 'YYYY-MM-DD'), :quantsold, :rate, :tax, :totamt)`;

        const bindObject = {
          newSaleId: newSaleId,
          cusid: cusid,
          itemid: itemid,
          transdate: transdate,
          quantsold: quantsold,
          rate: rate,
          tax: tax,
          totamt: totamt
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
      const saleId = req.url.split('/').pop(); // Ensure saleId is defined here
      let connection;
      try {
        connection = await oracledb.getConnection(dbConfig);
        const result = await connection.execute(
          'SELECT TRANSACTION_ID, CUSTOMER_ID, ITEM_ID, TRANSACTION_DATE, QUANTITY_SOLD, RATE, TAX, TOTAL_AMOUNT FROM SALE_TRANSACTION WHERE TRANSACTION_ID = :saleId',
          [saleId]
        );
        if (result.rows.length === 1) {
          const template = fs.readFileSync('../views/sale_edit.ejs', 'utf8');
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
      const saleId = req.url.split('/').pop(); // Ensure saleId is defined here
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', async () => {
        const formData = new URLSearchParams(body);
        const cusid = formData.get('cusid');
        const itemid = formData.get('itemid');
        const transdate = formData.get('transdate');
        const quantsold = formData.get('quantsold');
        const rate = formData.get('rate');
        const tax = formData.get('tax');
        const totamt = formData.get('totamt');

        let connection;
        try {
          connection = await oracledb.getConnection(dbConfig);
          const sql = `UPDATE SALE_TRANSACTION 
                       SET CUSTOMER_ID = :cusid, ITEM_ID = :itemid, TRANSACTION_DATE = TO_DATE(:transdate, 'YYYY-MM-DD'), QUANTITY_SOLD = :quantsold, RATE = :rate, TAX = :tax, TOTAL_AMOUNT = :totamt
                       WHERE TRANSACTION_ID = :saleId`;
          const bindObject = {
            saleId: { val: saleId },
            cusid: { val: cusid },
            itemid: { val: itemid },
            transdate: { val: transdate },
            quantsold: { val: quantsold },
            rate: { val: rate },
            tax: { val: tax },
            totamt: { val: totamt }
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
        const result = await connection.execute('SELECT TRANSACTION_ID, CUSTOMER_ID, ITEM_ID, TRANSACTION_DATE, QUANTITY_SOLD, RATE, TAX, TOTAL_AMOUNT FROM SALE_TRANSACTION');
        const template = fs.readFileSync('../views/sale_table.ejs', 'utf8');
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

const PORT = process.env.PORT || 3008;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
