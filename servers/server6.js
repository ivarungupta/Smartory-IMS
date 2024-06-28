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
    if (req.method === 'POST' && req.url === '/submitPurchase') {
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
        const maxIdResult = await connection.execute('SELECT MAX(ORDER_ID) AS max_id FROM PURCHASING_DETAIL');
        const maxId = maxIdResult.rows[0].MAX_ID;
        const newOrderId = (maxId ? parseInt(maxId) + 1 : 1).toString().padStart(5, '0');

        const suppid = formData.get('suppid');
        const orddate = formData.get('orddate');
        const quantord = formData.get('quantord');
        const rate = formData.get('rate');
        const itemid = formData.get('itemid');

        const sql = `INSERT INTO PURCHASING_DETAIL 
                     (ORDER_ID, SUPPLIER_ID, ORDER_DATE, QUANTITY_ORDERED, RATE, ITEM_ID) 
                     VALUES (:newOrderId, :suppid, TO_DATE(:orddate, 'YYYY-MM-DD'), :quantord, :rate, :itemid)`;

        const bindObject = {
          newOrderId: { val: newOrderId },
          suppid: { val: suppid },
          orddate: { val: orddate },
          quantord: { val: quantord },
          rate: { val: rate },
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
      const orderId = req.url.split('/').pop(); // Ensure orderId is defined here
      let connection;
      try {
        connection = await oracledb.getConnection(dbConfig);
        const result = await connection.execute(
          'SELECT ORDER_ID, SUPPLIER_ID, ORDER_DATE, QUANTITY_ORDERED, RATE, ITEM_ID FROM PURCHASING_DETAIL WHERE ORDER_ID = :orderId',
          [orderId]
        );
        if (result.rows.length === 1) {
          const template = fs.readFileSync('../views/purchasing_edit.ejs', 'utf8');
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
      const orderId = req.url.split('/').pop(); // Ensure orderId is defined here
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', async () => {
        const formData = new URLSearchParams(body);
        const suppid = formData.get('suppid');
        const orddate = formData.get('orddate');
        const quantord = formData.get('quantord');
        const rate = formData.get('rate');
        const itemid = formData.get('itemid');

        let connection;
        try {
          connection = await oracledb.getConnection(dbConfig);
          const sql = `UPDATE PURCHASING_DETAIL 
                       SET SUPPLIER_ID = :suppid, ORDER_DATE = TO_DATE(:orddate, 'YYYY-MM-DD'), 
                           QUANTITY_ORDERED = :quantord, RATE = :rate, ITEM_ID = :itemid
                       WHERE ORDER_ID = :orderId`;
          const bindObject = {
            orderId: { val: orderId },
            suppid: { val: suppid },
            orddate: { val: orddate },
            quantord: { val: quantord },
            rate: { val: rate },
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
        const result = await connection.execute('SELECT ORDER_ID, SUPPLIER_ID, ORDER_DATE, QUANTITY_ORDERED, RATE, ITEM_ID FROM PURCHASING_DETAIL');
        const template = fs.readFileSync('../views/purchasing_table.ejs', 'utf8');
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

const PORT = process.env.PORT || 3006;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
