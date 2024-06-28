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
        if (req.method === 'POST' && req.url === '/submitDelivery') {
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
                    const template = fs.readFileSync('../views/delivery_edit.ejs', 'utf8');
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
        } else {
            let connection;
            try {
                connection = await oracledb.getConnection(dbConfig);
                const result = await connection.execute('SELECT DELIVERY_ID, CUSTOMER_ID, ORDER_ID, DELIVERY_DATE, DELIVERED_QUANTITY, ITEM_ID FROM DELIVERY');
                const template = fs.readFileSync('../views/delivery_table.ejs', 'utf8');
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

const PORT = process.env.PORT || 3009;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});