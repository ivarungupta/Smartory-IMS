const http = require('http');
const oracledb = require('oracledb');
const ejs = require('ejs');
const fs = require('fs');
const bodyParser = require('body-parser');

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.extendedMetaData = true;
oracledb.enableQueryMode = true;
oracledb.autoCommit = true;
oracledb.initOracleClient({ libDir: 'C:\\\\oraclexe\\\\instantclient_11_2' });

const dbConfig = {
  user: 'inventory',
  password: 'Oracle1',
  connectString: '(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=localhost)(PORT=1521))(CONNECT_DATA=(SERVICE_NAME=xe)))'
};

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/submitCustomer') {
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
        const maxIdResult = await connection.execute('SELECT MAX(CUSTOMER_ID) AS max_id FROM CUSTOMER_MASTER');
        const maxId = maxIdResult.rows[0].MAX_ID;
        const newCustomerId = (maxId ? parseInt(maxId) + 1 : 1).toString().padStart(5, '0');

        const cusname = formData.get('cusname');
        const cuscont = formData.get('cuscont');
        const cusadd = formData.get('cusadd');
        const sql = `INSERT INTO CUSTOMER_MASTER (CUSTOMER_ID, CUSTOMER_NAME, CUSTOMER_CONTACT, CUSTOMER_ADDRESS) VALUES (:newCustomerId, :cusname, :cuscont, :cusadd)`;
        const bindObject = {
          newCustomerId: { val: newCustomerId },
          cusname: { val: cusname },
          cuscont: { val: cuscont },
          cusadd: { val: cusadd }
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
      const customerId = req.url.split('/').pop();
      let connection;
      try {
        connection = await oracledb.getConnection(dbConfig);
        const result = await connection.execute(
          'SELECT CUSTOMER_ID, CUSTOMER_NAME, CUSTOMER_CONTACT, CUSTOMER_ADDRESS FROM CUSTOMER_MASTER WHERE CUSTOMER_ID = :customerId',
          [customerId]
        );
        if (result.rows.length === 1) {
          const template = fs.readFileSync('../views/customer_edit.ejs', 'utf8');
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
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', async () => {
        const customerId = req.url.split('/').pop();
        const formData = new URLSearchParams(body);
        const cusname = formData.get('cusname');
        const cuscont = formData.get('cuscont');
        const cusadd = formData.get('cusadd');

        let connection;
        try {
          connection = await oracledb.getConnection(dbConfig);
          const sql = `UPDATE CUSTOMER_MASTER SET CUSTOMER_NAME = :cusname, CUSTOMER_CONTACT = :cuscont, CUSTOMER_ADDRESS = :cusadd WHERE CUSTOMER_ID = :customerId`;
          const bindObject = {
            customerId: { val: customerId },
            cusname: { val: cusname },
            cuscont: { val: cuscont },
            cusadd: { val: cusadd }
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
        const result = await connection.execute('SELECT CUSTOMER_ID, CUSTOMER_NAME, CUSTOMER_CONTACT, CUSTOMER_ADDRESS FROM CUSTOMER_MASTER');
        const template = fs.readFileSync('../views/customer_table.ejs', 'utf8');
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

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});