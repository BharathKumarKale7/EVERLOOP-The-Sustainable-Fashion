require("dotenv").config();
const mysql = require('mysql2/promise');

const config = {
  db: {
    host: process.env.DB_CONTAINER,
    port: process.env.DB_PORT,
    user: process.env.MYSQL_ROOT_USER,
    password: process.env.MYSQL_ROOT_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10, // Increased for better scalability
    queueLimit: 0,
  },
};

const pool = mysql.createPool(config.db);

async function query(sql, params) {
    try {
        const [rows] = await pool.execute(sql, params);
        return rows;
    } catch (err) {
        console.error('Database query error:', err.message);
        throw err;
    }
}

module.exports = { query };