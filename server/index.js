import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { pool, initializeDatabase } from './db.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.startsWith('replace-with-')) {
  console.warn('Set JWT_SECRET to a long random value in .env before using this app beyond local development.');
}
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '2mb' }));
const root = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.resolve(root, '../uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDir),
  filename: (_req, file, callback) => callback(null, `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${path.extname(file.originalname).toLowerCase()}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, callback) => {
  if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) return callback(null, true);
  callback(new Error('Only JPG, PNG, WEBP, and GIF image files are allowed.'));
} });
app.use('/uploads', express.static(uploadDir));

async function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Please sign in to continue.' });
  try {
    const claims = jwt.verify(token, jwtSecret || 'local-development-secret');
    const users = await rows('SELECT id, employee_code, username, role, full_name, active FROM users WHERE id=?', [claims.id]);
    const user = users[0];
    if (!user || !user.active) return res.status(401).json({ error: 'This account is inactive. Please contact an administrator.' });
    req.user = { id: user.id, employeeCode: user.employee_code, username: user.username, role: user.role, fullName: user.full_name };
    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    }
    return next(error);
  }
}
function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Administrator access is required.' });
  return next();
}
function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
const rows = async (sql, params = []) => (await pool.execute(sql, params))[0];
function invalidProductInput({ barcode, name, shopQty = 0, factoryQty = 0, price = 0 }) {
  if (!barcode?.trim() || !name?.trim()) return 'Barcode and item name are required.';
  if (!Number.isInteger(Number(shopQty)) || Number(shopQty) < 0 || !Number.isInteger(Number(factoryQty)) || Number(factoryQty) < 0) {
    return 'Shop and factory quantities must be non-negative whole numbers.';
  }
  if (!Number.isFinite(Number(price)) || Number(price) < 0) return 'Selling price must be a non-negative amount.';
  return '';
}

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const { password, role } = req.body || {};
  const identifier = req.body?.identifier || req.body?.username;
  if (!identifier || !password) return res.status(400).json({ error: 'Enter your staff ID and password.' });
  if (role && !['admin', 'cashier'].includes(role)) return res.status(400).json({ error: 'Choose Admin or Cashier sign-in.' });
  const users = role
    ? await rows('SELECT id, employee_code, username, password_hash, role, full_name, active FROM users WHERE (employee_code=? OR username=?) AND role=?', [identifier.trim(), identifier.trim(), role])
    : await rows('SELECT id, employee_code, username, password_hash, role, full_name, active FROM users WHERE employee_code=? OR username=?', [identifier.trim(), identifier.trim()]);
  const user = users[0];
  if (!user || !user.active || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role, fullName: user.full_name }, jwtSecret || 'local-development-secret', { expiresIn: '12h' });
  res.json({ token, user: { id: user.id, employeeCode: user.employee_code, username: user.username, role: user.role, fullName: user.full_name } });
}));

app.get('/api/session', authenticate, (req, res) => res.json({ user: req.user }));
app.get('/api/checkout-settings', authenticate, asyncRoute(async (_req, res) => {
  const settings = await rows("SELECT setting_key,setting_value FROM settings WHERE setting_key IN ('tax_rate','kbz_pay_qr','wave_pay_qr','aya_pay_qr')");
  res.json(Object.fromEntries(settings.map((setting) => [setting.setting_key, setting.setting_value])));
}));
app.post('/api/auth/change-password', authenticate, asyncRoute(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ error: 'Enter your current password and a new password of at least 8 characters.' });
  }
  const users = await rows('SELECT password_hash FROM users WHERE id=?', [req.user.id]);
  if (!users[0] || !(await bcrypt.compare(currentPassword, users[0].password_hash))) {
    return res.status(400).json({ error: 'Your current password is incorrect.' });
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await rows('UPDATE users SET password_hash=? WHERE id=?', [passwordHash, req.user.id]);
  res.json({ ok: true });
}));
app.post('/api/upload', authenticate, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose an image to upload.' });
  res.status(201).json({ url: `/uploads/${req.file.filename}` });
});

app.get('/api/dashboard', authenticate, adminOnly, asyncRoute(async (_req, res) => {
  const [summary] = await rows(`SELECT
    (SELECT COUNT(*) FROM products) AS products,
    (SELECT COALESCE(SUM(shop_qty),0) FROM products) AS units_in_shop,
    (SELECT COUNT(*) FROM sales WHERE DATE(created_at)=CURDATE()) AS sales_today,
    (SELECT COALESCE(SUM(total),0) FROM sales WHERE DATE(created_at)=CURDATE()) AS revenue_today,
    (SELECT COUNT(*) FROM vip_customers) AS vip_customers,
    (SELECT COUNT(*) FROM users WHERE role='cashier' AND active=1) AS cashiers`);
  const weeklySales = await rows(`SELECT DATE_FORMAT(day_list.day, '%a') AS label,
    COALESCE(SUM(s.total),0) AS revenue, COUNT(s.id) AS transactions
    FROM (SELECT CURDATE() - INTERVAL 6 DAY AS day UNION ALL SELECT CURDATE() - INTERVAL 5 DAY
      UNION ALL SELECT CURDATE() - INTERVAL 4 DAY UNION ALL SELECT CURDATE() - INTERVAL 3 DAY
      UNION ALL SELECT CURDATE() - INTERVAL 2 DAY UNION ALL SELECT CURDATE() - INTERVAL 1 DAY UNION ALL SELECT CURDATE()) day_list
    LEFT JOIN sales s ON DATE(s.created_at)=day_list.day GROUP BY day_list.day ORDER BY day_list.day`);
  const bestsellers = await rows(`SELECT item_name AS name, SUM(quantity) AS quantity
    FROM sale_items GROUP BY item_name ORDER BY quantity DESC LIMIT 5`);
  res.json({ summary, weeklySales, bestsellers });
}));

app.get('/api/sales/export', authenticate, adminOnly, asyncRoute(async (_req, res) => {
  res.json(await rows(`SELECT s.id AS sale_id, COALESCE(u.employee_code,'') AS cashier_id,
    COALESCE(u.full_name,'Removed cashier') AS cashier_name,
    (SELECT GROUP_CONCAT(CONCAT(si.item_name, ' ×', si.quantity) SEPARATOR ', ') FROM sale_items si WHERE si.sale_id=s.id) AS items,
    s.subtotal, s.tax_rate, s.tax_amount, s.total, s.payment_method, s.created_at
    FROM sales s LEFT JOIN users u ON u.id=s.cashier_id ORDER BY s.created_at DESC`));
}));

app.get('/api/products', authenticate, asyncRoute(async (_req, res) => {
  res.json(await rows('SELECT * FROM products ORDER BY name'));
}));
app.post('/api/products', authenticate, adminOnly, asyncRoute(async (req, res) => {
  const { barcode, name, photoUrl = '', shopQty = 0, factoryQty = 0, size = '', price = 0 } = req.body;
  const invalidInput = invalidProductInput({ barcode, name, shopQty, factoryQty, price });
  if (invalidInput) return res.status(400).json({ error: invalidInput });
  const result = await rows('INSERT INTO products (barcode,name,photo_url,shop_qty,factory_qty,size,price) VALUES (?,?,?,?,?,?,?)',
    [barcode.trim(), name.trim(), photoUrl, Number(shopQty) || 0, Number(factoryQty) || 0, size, Number(price) || 0]);
  res.status(201).json({ id: result.insertId });
}));
app.put('/api/products/:id', authenticate, adminOnly, asyncRoute(async (req, res) => {
  const { barcode, name, photoUrl = '', shopQty = 0, factoryQty = 0, size = '', price = 0 } = req.body;
  const invalidInput = invalidProductInput({ barcode, name, shopQty, factoryQty, price });
  if (invalidInput) return res.status(400).json({ error: invalidInput });
  await rows('UPDATE products SET barcode=?,name=?,photo_url=?,shop_qty=?,factory_qty=?,size=?,price=? WHERE id=?',
    [barcode.trim(), name.trim(), photoUrl, Number(shopQty) || 0, Number(factoryQty) || 0, size, Number(price) || 0, req.params.id]);
  res.json({ ok: true });
}));
app.delete('/api/products/:id', authenticate, adminOnly, asyncRoute(async (req, res) => {
  await rows('DELETE FROM products WHERE id=?', [req.params.id]);
  res.json({ ok: true });
}));

app.get('/api/suppliers', authenticate, asyncRoute(async (_req, res) => res.json(await rows('SELECT * FROM suppliers ORDER BY name'))));
app.post('/api/suppliers', authenticate, adminOnly, asyncRoute(async (req, res) => {
  const { name, phone = '', email = '', address = '', notes = '' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Supplier name is required.' });
  const result = await rows('INSERT INTO suppliers (name,phone,email,address,notes) VALUES (?,?,?,?,?)', [name.trim(), phone, email, address, notes]);
  res.status(201).json({ id: result.insertId });
}));
app.put('/api/suppliers/:id', authenticate, adminOnly, asyncRoute(async (req, res) => {
  const { name, phone = '', email = '', address = '', notes = '' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Supplier name is required.' });
  await rows('UPDATE suppliers SET name=?,phone=?,email=?,address=?,notes=? WHERE id=?', [name.trim(), phone, email, address, notes, req.params.id]);
  res.json({ ok: true });
}));
app.delete('/api/suppliers/:id', authenticate, adminOnly, asyncRoute(async (req, res) => {
  await rows('DELETE FROM suppliers WHERE id=?', [req.params.id]);
  res.json({ ok: true });
}));

app.get('/api/purchases', authenticate, asyncRoute(async (_req, res) => res.json(await rows(`SELECT p.*, i.name AS item_name, i.barcode, s.name AS supplier_name
  FROM purchases p JOIN products i ON i.id=p.product_id LEFT JOIN suppliers s ON s.id=p.supplier_id ORDER BY p.purchased_at DESC`))));
app.post('/api/purchases', authenticate, adminOnly, asyncRoute(async (req, res) => {
  const { productId, supplierId, quantity, unitCost = 0, destination = 'shop' } = req.body;
  if (!Number(productId) || !Number.isInteger(Number(quantity)) || Number(quantity) < 1 || !Number.isFinite(Number(unitCost)) || Number(unitCost) < 0 || !['shop', 'factory'].includes(destination)) {
    return res.status(400).json({ error: 'Select an item, enter a positive whole quantity, and choose a valid destination.' });
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('INSERT INTO purchases (product_id,supplier_id,quantity,unit_cost,destination) VALUES (?,?,?,?,?)',
      [productId, supplierId || null, quantity, Number(unitCost) || 0, destination]);
    const stockColumn = destination === 'shop' ? 'shop_qty' : 'factory_qty';
    await connection.execute(`UPDATE products SET ${stockColumn}=${stockColumn}+? WHERE id=?`, [quantity, productId]);
    await connection.commit();
    res.status(201).json({ ok: true });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}));

app.get('/api/sales', authenticate, adminOnly, asyncRoute(async (_req, res) => res.json(await rows(`SELECT s.id,s.total,s.subtotal,s.tax_amount,s.payment_method,s.created_at,
  COALESCE(u.full_name,'Removed cashier') AS cashier_name,
  (SELECT GROUP_CONCAT(CONCAT(si.item_name, ' ×', si.quantity) SEPARATOR ', ') FROM sale_items si WHERE si.sale_id=s.id) AS items
  FROM sales s LEFT JOIN users u ON u.id=s.cashier_id ORDER BY s.created_at DESC LIMIT 1000`))));
app.post('/api/sales', authenticate, asyncRoute(async (req, res) => {
  const { items, paymentMethod = 'Cash' } = req.body || {};
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Add at least one item to the sale.' });
  if (!['Cash', 'KBZ Pay', 'Wave Pay', 'AYA Pay'].includes(paymentMethod)) return res.status(400).json({ error: 'Choose Cash, KBZ Pay, Wave Pay, or AYA Pay.' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [settings] = await connection.execute("SELECT setting_value FROM settings WHERE setting_key='tax_rate'");
    const taxRate = Number(settings[0]?.setting_value) || 0;
    let subtotal = 0;
    const prepared = [];
    for (const item of items) {
      const quantity = Number(item.quantity);
      const [products] = await connection.execute('SELECT id,name,barcode,price,shop_qty FROM products WHERE id=? FOR UPDATE', [item.productId]);
      const product = products[0];
      if (!product || !Number.isInteger(quantity) || quantity < 1) throw new Error('A sale item or its quantity is invalid.');
      if (product.shop_qty < quantity) throw new Error(`Not enough shop stock for ${product.name}.`);
      const lineTotal = Number(product.price) * quantity;
      subtotal += lineTotal;
      prepared.push({ ...product, quantity, lineTotal });
    }
    const taxAmount = subtotal * taxRate / 100;
    const total = subtotal + taxAmount;
    const [saleResult] = await connection.execute(
      'INSERT INTO sales (cashier_id,subtotal,tax_rate,tax_amount,total,payment_method) VALUES (?,?,?,?,?,?)',
      [req.user.id, subtotal, taxRate, taxAmount, total, paymentMethod],
    );
    for (const item of prepared) {
      await connection.execute('INSERT INTO sale_items (sale_id,product_id,item_name,barcode,quantity,unit_price,line_total) VALUES (?,?,?,?,?,?,?)',
        [saleResult.insertId, item.id, item.name, item.barcode, item.quantity, item.price, item.lineTotal]);
      await connection.execute('UPDATE products SET shop_qty=shop_qty-? WHERE id=?', [item.quantity, item.id]);
    }
    await connection.commit();
    res.status(201).json({ id: saleResult.insertId, subtotal, taxRate, taxAmount, total });
  } catch (error) {
    await connection.rollback();
    if (error.message.startsWith('Not enough') || error.message.startsWith('A sale')) return res.status(400).json({ error: error.message });
    throw error;
  } finally {
    connection.release();
  }
}));

app.get('/api/vips', authenticate, adminOnly, asyncRoute(async (_req, res) => res.json(await rows('SELECT * FROM vip_customers ORDER BY created_at DESC'))));
app.post('/api/vips', authenticate, adminOnly, asyncRoute(async (req, res) => {
  const { name, phone = '', email = '', points = 0, notes = '' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'VIP customer name is required.' });
  if (!Number.isInteger(Number(points)) || Number(points) < 0) return res.status(400).json({ error: 'Loyalty points must be a non-negative whole number.' });
  const result = await rows('INSERT INTO vip_customers (name,phone,email,points,notes) VALUES (?,?,?,?,?)', [name.trim(), phone, email, Number(points) || 0, notes]);
  res.status(201).json({ id: result.insertId });
}));
app.put('/api/vips/:id', authenticate, adminOnly, asyncRoute(async (req, res) => {
  const { name, phone = '', email = '', points = 0, notes = '' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'VIP customer name is required.' });
  if (!Number.isInteger(Number(points)) || Number(points) < 0) return res.status(400).json({ error: 'Loyalty points must be a non-negative whole number.' });
  await rows('UPDATE vip_customers SET name=?,phone=?,email=?,points=?,notes=? WHERE id=?', [name.trim(), phone, email, Number(points) || 0, notes, req.params.id]);
  res.json({ ok: true });
}));
app.delete('/api/vips/:id', authenticate, adminOnly, asyncRoute(async (req, res) => {
  await rows('DELETE FROM vip_customers WHERE id=?', [req.params.id]);
  res.json({ ok: true });
}));

app.get('/api/users', authenticate, adminOnly, asyncRoute(async (_req, res) => res.json(await rows("SELECT id,employee_code,username,full_name,active,created_at FROM users WHERE role='cashier' ORDER BY full_name"))));
app.post('/api/users', authenticate, adminOnly, asyncRoute(async (req, res) => {
  const { employeeCode, username, password, fullName } = req.body || {};
  if (!employeeCode?.trim() || !username?.trim() || !password || password.length < 8 || !fullName?.trim()) {
    return res.status(400).json({ error: 'Enter a staff ID, name, username, and password of at least 8 characters.' });
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await rows("INSERT INTO users (employee_code,username,password_hash,role,full_name) VALUES (?,?,?, 'cashier', ?)", [employeeCode.trim(), username.trim(), passwordHash, fullName.trim()]);
  res.status(201).json({ id: result.insertId, employeeCode: employeeCode.trim() });
}));
app.patch('/api/users/:id', authenticate, adminOnly, asyncRoute(async (req, res) => {
  await rows("UPDATE users SET active=? WHERE id=? AND role='cashier'", [Boolean(req.body.active), req.params.id]);
  res.json({ ok: true });
}));

app.get('/api/settings', authenticate, adminOnly, asyncRoute(async (_req, res) => {
  const settings = await rows('SELECT setting_key,setting_value FROM settings');
  res.json(Object.fromEntries(settings.map((setting) => [setting.setting_key, setting.setting_value])));
}));
app.put('/api/settings', authenticate, adminOnly, asyncRoute(async (req, res) => {
  const taxRate = Number(req.body.tax_rate);
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) return res.status(400).json({ error: 'Tax rate must be from 0 to 100.' });
  await rows("INSERT INTO settings (setting_key,setting_value) VALUES ('tax_rate',?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)", [String(taxRate)]);
  for (const key of ['kbz_pay_qr', 'wave_pay_qr', 'aya_pay_qr']) {
    if (typeof req.body[key] === 'string') {
      await rows('INSERT INTO settings (setting_key,setting_value) VALUES (?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)', [key, req.body[key]]);
    }
  }
  res.json({ ok: true });
}));

app.use((error, _req, res, _next) => {
  if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'That barcode or username is already in use.' });
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Image must be 5 MB or smaller.' });
  console.error(error);
  res.status(500).json({ error: 'Something went wrong. Check the server log for details.' });
});

initializeDatabase().then(() => {
  app.listen(port, () => console.log(`Fashion POS API listening on http://localhost:${port}`));
}).catch((error) => {
  console.error('Could not initialize MySQL. Confirm the MySQL service and DB settings in .env.', error);
  process.exit(1);
});
