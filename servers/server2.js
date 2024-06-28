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
        if (req.method === 'POST' && req.url === '/submitItem') {
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
                    const template = fs.readFileSync('../views/item_edit.ejs', 'utf8');
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
        } else {
            let connection;
            try {
                connection = await oracledb.getConnection(dbConfig);
                const result = await connection.execute('SELECT ITEM_ID, ITEM_NAME, UOM, REORDERING, ITEM_QUANTITY FROM ITEM_MASTER');
                const template = fs.readFileSync('../views/item_table.ejs', 'utf8');
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

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});