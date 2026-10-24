import mysql from 'mysql2/promise'

// Host clean karein (agar ghalti se https:// ya port laga ho to saaf karein)
const rawHost = process.env.DB_HOST || process.env.MYSQLHOST || 'mysql-3214c583-moeedcontact-00f8.l.aivencloud.com'
const cleanHost = rawHost.replace(/^https?:\/\//, '').split(':')[0].trim()

const pool = mysql.createPool({
  host: cleanHost,
  user: process.env.DB_USER || process.env.MYSQLUSER || 'avnadmin',
  password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || 'AVNS_DNDcjW8QD1AAv_FnvPb',
  database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'defaultdb',
  port: Number(process.env.DB_PORT || process.env.MYSQLPORT) || 21830,
  ssl: {
    rejectUnauthorized: false
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 20000
})

export async function ensureDb() {
  const query = `
    CREATE TABLE IF NOT EXISTS sessions (
      token VARCHAR(120) PRIMARY KEY,
      number VARCHAR(20) NOT NULL,
      version INT DEFAULT 1,
      files LONGTEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `
  await pool.query(query)
}

export async function putSession({ token, number, version = 1, files }) {
  const query = `
    INSERT INTO sessions (token, number, version, files)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE files = VALUES(files), version = VALUES(version);
  `
  await pool.query(query, [token, number, version, JSON.stringify(files)])
}

export async function getSession(token) {
  const [rows] = await pool.query('SELECT version, files FROM sessions WHERE token = ? LIMIT 1', [token])
  if (!rows || rows.length === 0) return null
  return {
    version: rows[0].version,
    files: typeof rows[0].files === 'string' ? JSON.parse(rows[0].files) : rows[0].files
  }
}

export async function updateSession(token, files) {
  const [result] = await pool.query(
    'UPDATE sessions SET files = ?, updated_at = NOW() WHERE token = ?',
    [JSON.stringify(files), token]
  )
  return result.affectedRows > 0
}

export async function pruneSessions(days = 30) {
  await pool.query('DELETE FROM sessions WHERE updated_at < NOW() - INTERVAL ? DAY', [days])
}
