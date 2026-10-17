import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};

export const pool = mysql.createPool({
  ...dbConfig,
  database: process.env.DB_NAME || 'fashion_pos',
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true,
  dateStrings: true,
});

export async function initializeDatabase() {
  const bootstrap = await mysql.createConnection(dbConfig);
  const database = (process.env.DB_NAME || 'fashion_pos').replaceAll('`', '');
  await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await bootstrap.end();

  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY, employee_code VARCHAR(32) NOT NULL UNIQUE,
      username VARCHAR(80) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL, role ENUM('admin','cashier') NOT NULL DEFAULT 'cashier',
      full_name VARCHAR(120) NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS suppliers (
      id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(150) NOT NULL, phone VARCHAR(60) DEFAULT '',
      email VARCHAR(150) DEFAULT '', address TEXT, notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY, barcode VARCHAR(100) NOT NULL UNIQUE, name VARCHAR(180) NOT NULL,
      photo_url TEXT, shop_qty INT NOT NULL DEFAULT 0, factory_qty INT NOT NULL DEFAULT 0,
      size VARCHAR(80) DEFAULT '', price DECIMAL(12,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS purchases (
      id INT AUTO_INCREMENT PRIMARY KEY, product_id INT NOT NULL, supplier_id INT,
      quantity INT NOT NULL, unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
      destination ENUM('shop','factory') NOT NULL DEFAULT 'shop',
      purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id), FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS sales (
      id INT AUTO_INCREMENT PRIMARY KEY, cashier_id INT, subtotal DECIMAL(12,2) NOT NULL,
      tax_rate DECIMAL(6,3) NOT NULL DEFAULT 0, tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      total DECIMAL(12,2) NOT NULL, payment_method VARCHAR(40) NOT NULL DEFAULT 'Cash',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS sale_items (
      id INT AUTO_INCREMENT PRIMARY KEY, sale_id INT NOT NULL, product_id INT,
      item_name VARCHAR(180) NOT NULL, barcode VARCHAR(100), quantity INT NOT NULL,
      unit_price DECIMAL(12,2) NOT NULL, line_total DECIMAL(12,2) NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS vip_customers (
      id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(150) NOT NULL, phone VARCHAR(60) NOT NULL DEFAULT '',
      email VARCHAR(150) DEFAULT '', points INT NOT NULL DEFAULT 0, notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      setting_key VARCHAR(100) PRIMARY KEY, setting_value TEXT
    )`,
  ];
  for (const statement of statements) await pool.query(statement);

  const [employeeCodeColumn] = await pool.query("SHOW COLUMNS FROM users LIKE 'employee_code'");
  if (employeeCodeColumn.length === 0) await pool.query('ALTER TABLE users ADD COLUMN employee_code VARCHAR(32) NULL UNIQUE AFTER id');
  await pool.query(`UPDATE users SET employee_code=CONCAT(IF(role='admin','ADMIN','CASH'), LPAD(id,4,'0'))
    WHERE employee_code IS NULL OR employee_code=''`);
  await pool.query('ALTER TABLE users MODIFY employee_code VARCHAR(32) NOT NULL');

  await pool.query(`INSERT IGNORE INTO settings (setting_key, setting_value) VALUES
    ('tax_rate','0'), ('kbz_pay_qr',''), ('wave_pay_qr',''), ('aya_pay_qr','')`);
  const [legacyQr] = await pool.query("SELECT setting_value FROM settings WHERE setting_key='mobile_qr'");
  if (legacyQr.length && legacyQr[0].setting_value) {
    await pool.execute("UPDATE settings SET setting_value=? WHERE setting_key='kbz_pay_qr' AND setting_value=''", [legacyQr[0].setting_value]);
  }
  const [admins] = await pool.query("SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1");
  if (admins.length === 0) {
    const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
    const passwordHash = await bcrypt.hash(password, 12);
    await pool.execute(
      'INSERT INTO users (employee_code, username, password_hash, role, full_name) VALUES (?, ?, ?, ?, ?)',
      [process.env.ADMIN_ID || 'ADMIN001', process.env.ADMIN_USERNAME || 'admin', passwordHash, 'admin', 'Shop Administrator'],
    );
    console.log(`Initial admin created: ${process.env.ADMIN_USERNAME || 'admin'} (change the password after login).`);
  } else {
    await pool.execute('UPDATE users SET employee_code=? WHERE id=?', [process.env.ADMIN_ID || 'ADMIN001', admins[0].id]);
  }

  const [cashiers] = await pool.query("SELECT id FROM users WHERE role='cashier' LIMIT 1");
  if (cashiers.length === 0) {
    const passwordHash = await bcrypt.hash(process.env.CASHIER_PASSWORD || 'ShopCashier123!', 12);
    await pool.execute(
      'INSERT INTO users (employee_code, username, password_hash, role, full_name) VALUES (?, ?, ?, ?, ?)',
      [process.env.CASHIER_ID || 'CASHIER001', process.env.CASHIER_USERNAME || 'cashier', passwordHash, 'cashier', 'Shop Cashier'],
    );
    console.log(`Initial cashier created: ${process.env.CASHIER_USERNAME || 'cashier'} (change the password after login).`);
  }
}
