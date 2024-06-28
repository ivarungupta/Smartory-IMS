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
  let connection;
  try{
  try {
    connection = await oracledb.getConnection(dbConfig);
  }
    catch (err) {
      console.error('Error connecting to Oracle database:', err);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
      return;
    }

    // Customer Master
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
          const template = fs.readFileSync('./views/customer_edit.ejs', 'utf8');
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
    }

    // Item Master
    else if (req.method === 'POST' && req.url === '/submitItem') {
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
          const maxIdResult = await connection.execute('SELECT MAX(ITEM_ID) AS max_id FROM ITEM_MASTER');
          const maxId = maxIdResult.rows[0].MAX_ID;
          const newItemId = (maxId ? parseInt(maxId) + 1 : 1).toString().padStart(5, '0');

          const itemname = formData.get('itemname');
          const itemuom = formData.get('itemuom');
          const itemreord = formData.get('itemreord');
          const itemquant = formData.get('itemquant');
          const sql = `INSERT INTO ITEM_MASTER (ITEM_ID, ITEM_NAME, UOM, REORDERING, ITEM_QUANTITY) VALUES (:newItemId, :itemname, :itemuom, :itemreord, :itemquant)`;
          const bindObject = {
              newItemId: { val: newItemId },
              itemname: { val: itemname },
              itemuom: { val: itemuom },
              itemreord: { val: itemreord },
              itemquant: { val: itemquant }
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
      const itemId = req.url.split('/').pop();
      let connection;
      try {
          connection = await oracledb.getConnection(dbConfig);
          const result = await connection.execute(
              'SELECT ITEM_ID, ITEM_NAME, UOM, REORDERING, ITEM_QUANTITY FROM ITEM_MASTER WHERE ITEM_ID = :itemId',
              [itemId]
          );
          if (result.rows.length === 1) {
              const template = fs.readFileSync('./views/item_edit.ejs', 'utf8');
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
          const itemId = req.url.split('/').pop();
          const formData = new URLSearchParams(body);
          const itemname = formData.get('itemname');
          const itemuom = formData.get('itemuom');
          const itemreord = formData.get('itemreord');
          const itemquant = formData.get('itemquant');

          let connection;
          try {
              connection = await oracledb.getConnection(dbConfig);
              const sql = `UPDATE ITEM_MASTER SET ITEM_NAME = :itemname, UOM = :itemuom, REORDERING = :itemreord, ITEM_QUANTITY = :itemquant WHERE ITEM_ID = :itemId`;
              const bindObject = {
                  itemId: { val: itemId },
                  itemname: { val: itemname },
                  itemuom: { val: itemuom },
                  itemreord: { val: itemreord },
                  itemquant: { val: itemquant }
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
  }

    // Supplies Master
    else if (req.method === 'POST' && req.url === '/submitSupplies') {
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
        const maxIdResult = await connection.execute('SELECT MAX(SUPPLIER_ID) AS max_id FROM SUPPLIES_MASTER');
        const maxId = maxIdResult.rows[0].MAX_ID;
        const newSupplierId = (maxId ? parseInt(maxId) + 1 : 1).toString().padStart(5, '0');

        const suppname = formData.get('suppname');
        const suppcont = formData.get('suppcont');
        const suppadd = formData.get('suppadd');
        const sql = `INSERT INTO SUPPLIES_MASTER (SUPPLIER_ID, SUPPLIER_NAME, SUPPLIER_CONTACT, SUPPLIER_ADDRESS) VALUES (:newSupplierId, :suppname, :suppcont, :suppadd)`;
        const bindObject = {
          newSupplierId: { val: newSupplierId},
          suppname: { val: suppname },
          suppcont: { val: suppcont },
          suppadd: { val: suppadd }
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
      const supplierId = req.url.split('/').pop();
      let connection;
      try {
        connection = await oracledb.getConnection(dbConfig);
        const result = await connection.execute(
          'SELECT SUPPLIER_ID, SUPPLIER_NAME, SUPPLIER_CONTACT, SUPPLIER_ADDRESS FROM SUPPLIES_MASTER WHERE SUPPLIER_ID = :supplierId',
          [supplierId]
        );
        if (result.rows.length === 1) {
          const template = fs.readFileSync('./views/supplies_edit.ejs', 'utf8');
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
        const supplierId = req.url.split('/').pop();
        const formData = new URLSearchParams(body);
        const suppname = formData.get('suppname');
        const suppcont = formData.get('suppcont');
        const suppadd = formData.get('suppadd');
        let connection;
        try {
          connection = await oracledb.getConnection(dbConfig);
          const sql = `UPDATE SUPPLIES_MASTER SET SUPPLIER_NAME = :suppname, SUPPLIER_CONTACT = :suppcont, SUPPLIER_ADDRESS = :suppadd WHERE SUPPLIER_ID = :supplierId`;
          const bindObject = {
            supplierId: { val: supplierId },
            suppname: { val: suppname },
            suppcont: { val: suppcont },
            suppadd: { val: suppadd }
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
    }

    // Tax
    else if (req.method === 'POST' && req.url === '/submitTax') {
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
          const template = fs.readFileSync('./views/tax_edit.ejs', 'utf8');
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
    } 

    // Misc Material Transaction
    else if (req.method === 'POST' && req.url === '/submitMisc'){
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
          const template = fs.readFileSync('./views/misc_edit.ejs', 'utf8');
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
    } 

    // Purchasing Detail
    else if (req.method === 'POST' && req.url === '/submitPurchase') {
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
          const template = fs.readFileSync('./views/purchasing_edit.ejs', 'utf8');
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
    }

    // Receiving Order Data
    else if (req.method === 'POST' && req.url === '/submitReceiving') {
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
          const template = fs.readFileSync('./views/receiving_edit.ejs', 'utf8');
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
    }  

    // Sale Transaction
    else if (req.method === 'POST' && req.url === '/submitSale') {
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
          const template = fs.readFileSync('./views/sale_edit.ejs', 'utf8');
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
    } 

    // Delivery
    else if (req.method === 'POST' && req.url === '/submitDelivery') {
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
          const maxIdResult = await connection.execute('SELECT MAX(DELIVERY_ID) AS max_id FROM DELIVERY');
          const maxId = maxIdResult.rows[0].MAX_ID;
          const newDeliveryId = (maxId ? parseInt(maxId) + 1 : 1).toString().padStart(5, '0');

          const cusid = formData.get('cusid');
          const ordid = formData.get('ordid');
          const deldate = formData.get('deldate');
          const delquant = formData.get('delquant');
          const itemid = formData.get('itemid');
          const sql = `INSERT INTO DELIVERY (DELIVERY_ID, CUSTOMER_ID, ORDER_ID, DELIVERY_DATE, DELIVERED_QUANTITY, ITEM_ID) VALUES (:newDeliveryId, :cusid, :ordid, TO_DATE(:deldate, 'YYYY-MM-DD'), :delquant, :itemid)`;
          const bindObject = {
              newDeliveryId: { val: newDeliveryId },
              cusid: { val: cusid },
              ordid: { val: ordid },
              deldate: { val: deldate },
              delquant: { val: delquant },
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
      const deliveryId = req.url.split('/').pop();
      let connection;
      try {
          connection = await oracledb.getConnection(dbConfig);
          const result = await connection.execute(
              'SELECT DELIVERY_ID, CUSTOMER_ID, ORDER_ID, DELIVERY_DATE, DELIVERED_QUANTITY, ITEM_ID FROM DELIVERY WHERE DELIVERY_ID = :deliveryId',
              [deliveryId]
          );
          if (result.rows.length === 1) {
              const template = fs.readFileSync('./views/delivery_edit.ejs', 'utf8');
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
          const deliveryId = req.url.split('/').pop();
          const formData = new URLSearchParams(body);
          const cusid = formData.get('cusid');
          const ordid = formData.get('ordid');
          const deldate = formData.get('deldate');
          const delquant = formData.get('delquant');
          const itemid = formData.get('itemid');

          let connection;
          try {
              connection = await oracledb.getConnection(dbConfig);
              const sql = `UPDATE DELIVERY SET CUSTOMER_ID = :cusid, ORDER_ID = :ordid, DELIVERY_DATE = TO_DATE(:deldate, 'YYYY-MM-DD'), DELIVERED_QUANTITY = :delquant, ITEM_ID = :itemid WHERE DELIVERY_ID = :deliveryId`;
              const bindObject = {
                  deliveryId: { val: deliveryId },
                  cusid: { val: cusid },
                  ordid: { val: ordid },
                  deldate: { val: deldate },
                  delquant: { val: delquant },
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
  }

    // Inspection
    else if (req.method === 'POST' && req.url === '/submitInspection') {
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
          const template = fs.readFileSync('./views/inspection_edit.ejs', 'utf8');
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
    }

    // Default route (show tables)
    else if (req.method === 'GET' && req.url === '/') {
        // Fetch data for all tables and render their respective templates
        // .. (existing code for rendering table views)

        //customer
        const customerResult = await connection.execute('SELECT CUSTOMER_ID, CUSTOMER_NAME, CUSTOMER_CONTACT, CUSTOMER_ADDRESS FROM CUSTOMER_MASTER');
        const customerTemplate = fs.readFileSync('./views/customer_table.ejs', 'utf8');
        const customerRenderedHtml = ejs.render(customerTemplate, { data: customerResult.rows });
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(customerRenderedHtml);
        

        //item
        const itemResult = await connection.execute('SELECT ITEM_ID, ITEM_NAME, UOM, REORDERING, ITEM_QUANTITY FROM ITEM_MASTER');
        const itemTemplate = fs.readFileSync('./views/item_table.ejs', 'utf8');
        const itemRenderedHtml = ejs.render(itemTemplate, { data: itemResult.rows });
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(itemRenderedHtml);
        

        //supplies
        const suppliesResult = await connection.execute('SELECT SUPPLIER_ID, SUPPLIER_NAME, SUPPLIER_CONTACT, SUPPLIER_ADDRESS FROM SUPPLIES_MASTER');
        const suppliesTemplate = fs.readFileSync('./views/supplies_table.ejs', 'utf8');
        const suppliesRenderedHtml = ejs.render(suppliesTemplate, { data: suppliesResult.rows });
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(suppliesRenderedHtml);

        //tax
        const taxResult = await connection.execute('SELECT TAX_TYPE, RATE FROM TAX');
        const taxTemplate = fs.readFileSync('./views/tax_table.ejs', 'utf8');
        const taxRenderedHtml = ejs.render(taxTemplate, { data: taxResult.rows });
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(taxRenderedHtml);

        //misc
        const miscResult = await connection.execute('SELECT TRANSACTION_ID, TRANSACTION_VALUE, TRANSACTION_DATE, ITEM_ID, TRANSACTION_QUANTITY FROM MISC_MATERIAL_TRANSACTION');
        const miscTemplate = fs.readFileSync('./views/misc_table.ejs', 'utf8');
        const miscRenderedHtml = ejs.render(miscTemplate, { data: miscResult.rows });
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(miscRenderedHtml);

        //purchase
        const purchaseResult = await connection.execute('SELECT ORDER_ID, SUPPLIER_ID, ORDER_DATE, QUANTITY_ORDERED, RATE, ITEM_ID FROM PURCHASING_DETAIL');
        const purchaseTemplate = fs.readFileSync('./views/purchasing_table.ejs', 'utf8');
        const purchaseRenderedHtml = ejs.render(purchaseTemplate, { data: purchaseResult.rows });
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(purchaseRenderedHtml);

        //receiving
        const receivingResult = await connection.execute(`
          SELECT ORDER_ID, RECEIPT_NO, 
                 TO_CHAR(RECEIPT_DATE, 'YYYY-MM-DD') AS RECEIPT_DATE, 
                 RECEIPT_QUANTITY, 
                 TO_CHAR(RECEIVED_DATE, 'YYYY-MM-DD') AS RECEIVED_DATE, 
                 RECEIVED_QUANTITY, SUPPLIER_ID, ITEM_ID 
          FROM RECEIVING_ORDER_DATA
        `);
        const receivingTemplate = fs.readFileSync('./views/receiving_table.ejs', 'utf8');
        const receivingRenderedHtml = ejs.render(receivingTemplate, { data: receivingResult.rows });
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(receivingRenderedHtml);

        //sale
        const saleResult = await connection.execute('SELECT TRANSACTION_ID, CUSTOMER_ID, ITEM_ID, TRANSACTION_DATE, QUANTITY_SOLD, RATE, TAX, TOTAL_AMOUNT FROM SALE_TRANSACTION');
        const saleTemplate = fs.readFileSync('./views/sale_table.ejs', 'utf8');
        const saleRenderedHtml = ejs.render(saleTemplate, { data: saleResult.rows });
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(saleRenderedHtml);

        //delivery
        const deliveryResult = await connection.execute('SELECT DELIVERY_ID, CUSTOMER_ID, ORDER_ID, DELIVERY_DATE, DELIVERED_QUANTITY, ITEM_ID FROM DELIVERY');
        const deliveryTemplate = fs.readFileSync('./views/delivery_table.ejs', 'utf8');
        const deliveryRenderedHtml = ejs.render(deliveryTemplate, { data: deliveryResult.rows });
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(deliveryRenderedHtml);

        //inspection
        const inspectionResult = await connection.execute('SELECT INSPECTION_ID, RECEIPT_NO, INSPECTION_DATE, INSPECTION_RESULT, QUANTITY_ACCEPT, QUANTITY_REJECT, ITEM_ID FROM INSPECTION');
        const inspectionTemplate = fs.readFileSync('./views/inspection_table.ejs', 'utf8');
        const inspectionRenderedHtml = ejs.render(inspectionTemplate, { data: inspectionResult.rows });

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`${customerRenderedHtml}\n${itemRenderedHtml}\n${suppliesRenderedHtml}\n${taxRenderedHtml}\n${miscRenderedHtml}\n${purchaseRenderedHtml}\n${receivingRenderedHtml}\n${saleRenderedHtml}\n${deliveryRenderedHtml}\n${inspectionRenderedHtml}`);
    }
    else{
      res.writeHead(404,{'Content-Type': 'text/plain'});
      res.end('Not found');
    }
  }
       catch (err) {
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
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});