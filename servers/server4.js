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
    if (req.method === 'POST' && req.url === '/submitTax') {
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

        const taxtype = formData.get('taxtype');
        const taxrate = formData.get('taxrate');
        const sql = `INSERT INTO TAX (TAX_TYPE, RATE) VALUES (:taxtype, :taxrate)`;
        const bindObject = {
          taxtype: { val: taxtype },
          taxrate: { val: taxrate },
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
    } else if (req.method === 'GET' && /^\/edit\/(.+)$/.test(req.url)) {
      const taxtype = req.url.split('/').pop();
      let connection;
      try {
        connection = await oracledb.getConnection(dbConfig);
        const result = await connection.execute(
          'SELECT TAX_TYPE, RATE FROM TAX WHERE TAX_TYPE = :taxtype',
          [taxtype]
        );
        if (result.rows.length === 1) {
          const template = fs.readFileSync('../views/tax_edit.ejs', 'utf8');
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
    } else if (req.method === 'POST' && /^\/update\/(.+)$/.test(req.url)) {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', async () => {
        const taxtype = req.url.split('/').pop();
        const formData = new URLSearchParams(body);
        const taxrate = formData.get('taxrate');

        let connection;
        try {
          connection = await oracledb.getConnection(dbConfig);
          const sql = `UPDATE TAX SET RATE = :taxrate WHERE TAX_TYPE = :taxtype`;
          const bindObject = {
            taxtype: { val: taxtype },
            taxrate: { val: taxrate }
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
        const result = await connection.execute('SELECT TAX_TYPE, RATE FROM TAX');
        const template = fs.readFileSync('../views/tax_table.ejs', 'utf8');
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

const PORT = process.env.PORT || 3004;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
