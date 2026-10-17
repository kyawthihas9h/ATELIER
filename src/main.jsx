import React, { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, ArrowDownToLine, ArrowLeftRight, BadgePercent, BarChart3, Box, Boxes, Check, ChevronDown,
  CircleDollarSign, Clock3, CreditCard, Edit3, FileSpreadsheet, Heart, ImagePlus, LogOut, Menu,
  PackagePlus, Plus, QrCode, Search, Settings as SettingsIcon, ShoppingBag, ShoppingCart,
  Store, Trash2, Truck, UserRound, Users, X,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import './style.css';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'MMK', maximumFractionDigits: 0 });
const walletSettingKey = { 'KBZ Pay': 'kbz_pay_qr', 'Wave Pay': 'wave_pay_qr', 'AYA Pay': 'aya_pay_qr' };
const walletOptions = [
  { name: 'KBZ Pay', key: walletSettingKey['KBZ Pay'] },
  { name: 'Wave Pay', key: walletSettingKey['Wave Pay'] },
  { name: 'AYA Pay', key: walletSettingKey['AYA Pay'] },
];
const blank = { product: { barcode: '', name: '', photoUrl: '', shopQty: 0, factoryQty: 0, size: '', price: 0 }, supplier: { name: '', phone: '', email: '', address: '', notes: '' }, purchase: { productId: '', supplierId: '', quantity: 1, unitCost: 0, destination: 'shop' }, vip: { name: '', phone: '', email: '', points: 0, notes: '' }, cashier: { username: '', password: '', fullName: '' } };
const menuItems = [
  { id: 'dashboard', title: 'Dashboard', icon: BarChart3 },
  { id: 'sales', title: 'Sale Record', icon: CreditCard },
  { id: 'inventory', title: 'Inventory', icon: Boxes },
  { id: 'suppliers', title: 'Supplier List', icon: Truck },
  { id: 'vips', title: 'VIP List', icon: Heart },
  { id: 'cashiers', title: 'Cashiers', icon: Users },
  { id: 'settings', title: 'Settings', icon: SettingsIcon },
];

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('pos-token') || '');
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pos-user') || 'null'); } catch { return null; }
  });
  const [page, setPage] = useState(user?.role === 'admin' ? 'dashboard' : 'pos');
  const [toast, setToast] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [systemTime, setSystemTime] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setSystemTime(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const notify = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3600);
  }, []);

  const api = useCallback(async (url, options = {}) => {
    const headers = { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(url, { ...options, headers });
    const data = response.status === 204 ? null : await response.json();
    if (!response.ok) {
      if (response.status === 401 && url !== '/api/auth/login') {
        localStorage.removeItem('pos-token');
        localStorage.removeItem('pos-user');
        setToken('');
        setUser(null);
      }
      throw new Error(data?.error || 'Request failed.');
    }
    return data;
  }, [token]);

  const signOut = () => {
    localStorage.removeItem('pos-token');
    localStorage.removeItem('pos-user');
    setToken('');
    setUser(null);
    setPage('pos');
  };

  if (!token || !user) return <Login api={api} onLogin={(result) => {
    localStorage.setItem('pos-token', result.token);
    localStorage.setItem('pos-user', JSON.stringify(result.user));
    setToken(result.token);
    setUser(result.user);
    setPage(result.user.role === 'admin' ? 'dashboard' : 'pos');
  }} />;

  const activeTitle = page === 'pos' ? 'Point of sale' : (menuItems.find((item) => item.id === page)?.title || 'Point of sale');
  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><Store size={20} /></span><span className="brand-copy"><strong>ATELIER</strong><small>FASHION HOUSE</small></span></div>
        <div className="shop-label">WORKSPACE</div>
        <button className={`nav-link ${page === 'pos' ? 'active' : ''}`} onClick={() => setPage('pos')}><ShoppingCart size={18} /><span>Point of sale</span></button>
        {user.role === 'admin' && <>
          <div className="shop-label nav-spacer">MANAGEMENT</div>
          {menuItems.map(({ id, title, icon: Icon }) => <button className={`nav-link ${page === id ? 'active' : ''}`} key={id} onClick={() => setPage(id)}><Icon size={18} /><span>{title}</span></button>)}
        </>}
        <div className="sidebar-bottom">
          <div className="profile"><span className="avatar">{(user.fullName || user.username).slice(0, 1).toUpperCase()}</span><div className="profile-name"><strong>{user.fullName || user.username}</strong><small>{user.employeeCode || user.username} · {user.role === 'admin' ? 'Admin' : 'Cashier'}</small></div><ChevronDown size={15} /></div>
          <button className="nav-link signout" onClick={signOut}><LogOut size={18} /><span>Sign out</span></button>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setCollapsed(!collapsed)} aria-label="Toggle navigation"><Menu size={19} /></button>
          <div className="breadcrumb">Atelier <span>/</span> <strong>{activeTitle}</strong></div>
          <div className="topbar-right"><span className="live-dot" /> Store is open <span className="topbar-divider" /><span className="today-label">{systemTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · {systemTime.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span></div>
        </header>
        <div className="content-area">
          {page === 'dashboard' && user.role === 'admin' && <Dashboard api={api} systemTime={systemTime} onNavigate={() => setPage('pos')} />}
          {page === 'pos' && <PointOfSale api={api} user={user} notify={notify} />}
          {page === 'sales' && user.role === 'admin' && <SalesRecords api={api} notify={notify} />}
          {page === 'inventory' && user.role === 'admin' && <Inventory api={api} notify={notify} />}
          {page === 'suppliers' && user.role === 'admin' && <Directory api={api} notify={notify} kind="supplier" />}
          {page === 'vips' && user.role === 'admin' && <Directory api={api} notify={notify} kind="vip" />}
          {page === 'cashiers' && user.role === 'admin' && <Cashiers api={api} notify={notify} />}
          {page === 'settings' && user.role === 'admin' && <Settings api={api} notify={notify} />}
        </div>
      </main>
      {toast && <div className="toast"><Check size={17} />{toast}</div>}
    </div>
  );
}

function Login({ api, onLogin }) {
  const [role, setRole] = useState('admin');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try { onLogin(await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password, role }) })); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <div className="login-screen">
    <div className="login-visual"><div className="login-art"><div className="art-circle" /><div className="art-copy"><span>CURATED WITH CARE</span><h2>Style that<br />moves with you.</h2><p>A thoughtful way to run your fashion business.</p></div><div className="art-caption">ATELIER — YOUR SHOP, IN GOOD COMPANY</div></div></div>
    <div className="login-panel"><div className="login-box"><div className="login-brand"><span className="brand-mark"><Store size={20} /></span><span><strong>ATELIER</strong><small>FASHION HOUSE</small></span></div><div className="login-heading"><p className="eyebrow">WELCOME BACK</p><h1>Sign in to your shop</h1><p>Use your staff account to continue.</p></div>
      <form onSubmit={submit} className="login-form"><div className="role-switch" aria-label="Sign in as">{[['admin', 'Administrator'], ['cashier', 'Cashier']].map(([value, label]) => <button type="button" key={value} className={role === value ? 'selected' : ''} onClick={() => setRole(value)}>{label}</button>)}</div><label>Staff ID or username<input autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder={role === 'admin' ? 'e.g. ADMIN001' : 'e.g. CASHIER001'} required /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required /></label>
        {error && <div className="form-error">{error}</div>}<button className="button primary login-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}<ArrowLeftRight size={16} /></button>
      </form><div className="login-foot">Choose your role, then sign in with your staff ID or username and password.</div></div></div>
  </div>;
}

function PageHeading({ eyebrow, title, description, action }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>{action}</div>;
}
function Button({ children, onClick, variant = 'primary', icon: Icon = Plus, type = 'button', disabled = false }) {
  return <button type={type} className={`button ${variant}`} onClick={onClick} disabled={disabled}>{Icon && <Icon size={16} />}{children}</button>;
}
function useLoad(api, endpoint, deps = []) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    try { setData(await api(endpoint)); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, endpoint, ...deps]);
  useEffect(() => { refresh().catch((error) => console.error(error)); }, [refresh]);
  return { data, setData, loading, refresh };
}
function Loading() { return <div className="loading"><span className="spinner" /> Loading your shop…</div>; }
function Empty({ title = 'Nothing here yet', text = 'Add your first record to get started.' }) {
  return <div className="empty-state"><div className="empty-icon"><Box size={22} /></div><strong>{title}</strong><span>{text}</span></div>;
}
function SearchInput({ value, onChange, placeholder = 'Search…' }) {
  return <label className="search-input"><Search size={16} /><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /></label>;
}
function Modal({ title, onClose, onSubmit, fields, values, setValues, busy = false, api }) {
  const [uploading, setUploading] = useState(false);
  async function uploadImage(fieldName, file) {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const result = await api('/api/upload', { method: 'POST', body: form });
      setValues((old) => ({ ...old, [fieldName]: result.url }));
    } catch (error) { window.alert(error.message); }
    finally { setUploading(false); }
  }
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><form className="modal" onSubmit={onSubmit}>
    <div className="modal-header"><h2>{title}</h2><button className="icon-button" type="button" onClick={onClose}><X size={18} /></button></div>
    <div className="modal-fields">{fields.map((field) => <label key={field.name} className={field.wide ? 'field-wide' : ''}>{field.label}
      {field.type === 'select' ? <select value={values[field.name] ?? ''} required={field.required} onChange={(e) => setValues((old) => ({ ...old, [field.name]: e.target.value }))}>
        {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select> : field.type === 'textarea' ? <textarea rows="3" value={values[field.name] ?? ''} required={field.required} onChange={(e) => setValues((old) => ({ ...old, [field.name]: e.target.value }))} placeholder={field.placeholder || ''} />
        : field.type === 'image' ? <div className="image-field"><input type="url" value={values[field.name] ?? ''} onChange={(e) => setValues((old) => ({ ...old, [field.name]: e.target.value }))} placeholder="Paste an image URL" /><label className="upload-control"><ImagePlus size={16} />{uploading ? 'Uploading…' : 'Upload file'}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => uploadImage(field.name, e.target.files?.[0])} /></label></div>
        : <input type={field.type || 'text'} value={values[field.name] ?? ''} required={field.required} min={field.min} step={field.step} placeholder={field.placeholder || ''} autoComplete={field.autoComplete} onChange={(e) => setValues((old) => ({ ...old, [field.name]: field.type === 'number' ? e.target.value : e.target.value }))} />}
    </label>)}</div>
    <div className="modal-actions"><Button variant="secondary" icon={null} onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy || uploading}>{busy ? 'Saving…' : 'Save changes'}</Button></div>
  </form></div>;
}

function Dashboard({ api, systemTime, onNavigate }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setData(await api('/api/dashboard')); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [api]);
  useEffect(() => { load(); }, [load]);
  if (loading) return <Loading />;
  if (error) return <div className="dashboard-error"><div className="notice error-notice">{error}</div><Button variant="secondary" icon={Activity} onClick={load}>Retry dashboard</Button></div>;
  if (!data) return <Empty title="Dashboard is unavailable" text="Try again to reload your shop summary." />;
  const summary = data.summary;
  const greeting = systemTime.getHours() < 12 ? 'Good morning' : systemTime.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const cards = [
    { title: 'Today’s revenue', value: currency.format(summary.revenue_today), icon: CircleDollarSign, color: 'peach', note: `${summary.sales_today} transactions today` },
    { title: 'Items in shop', value: summary.units_in_shop, icon: ShoppingBag, color: 'lavender', note: `${summary.products} styles in inventory` },
    { title: 'VIP customers', value: summary.vip_customers, icon: Heart, color: 'pink', note: 'In your customer list' },
    { title: 'Active cashiers', value: summary.cashiers, icon: Users, color: 'green', note: 'Team members with access' },
  ];
  const chartData = data.bestsellers.length ? data.bestsellers : [{ name: 'No sales yet', quantity: 1 }];
  return <><PageHeading eyebrow="YOUR BUSINESS AT A GLANCE" title={`${greeting}.`} description="Here’s what’s happening in your shop today." action={<Button variant="secondary" icon={ShoppingBag} onClick={onNavigate}>Open point of sale</Button>} />
    <div className="stats-grid">{cards.map(({ title, value, icon: Icon, color, note }) => <div className="stat-card" key={title}><div className="stat-top"><span>{title}</span><span className={`stat-icon ${color}`}><Icon size={18} /></span></div><strong className="stat-value">{value}</strong><small>{note}</small></div>)}</div>
    <div className="chart-grid"><section className="panel chart-panel"><div className="panel-heading"><div><h2>Sales overview</h2><p>Revenue and transactions · last 7 days</p></div><span className="period-chip"><Activity size={13} /> This week</span></div>
      <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.weeklySales} barGap={5}><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#edeae4" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#95928d', fontSize: 12 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#95928d', fontSize: 11 }} width={36} /><Tooltip formatter={(value, name) => [name === 'revenue' ? currency.format(value) : value, name === 'revenue' ? 'Revenue' : 'Sales']} /><Bar dataKey="revenue" name="Revenue" fill="#9c6a4c" radius={[5, 5, 0, 0]} maxBarSize={30} /></BarChart></ResponsiveContainer></div>
    </section><section className="panel chart-panel"><div className="panel-heading"><div><h2>Top sellers</h2><p>Most purchased styles</p></div><span className="period-chip">By quantity</span></div>
      <div className="top-sellers"><ResponsiveContainer width="100%" height={205}><PieChart><Pie data={chartData} dataKey="quantity" nameKey="name" innerRadius={56} outerRadius={82} paddingAngle={data.bestsellers.length ? 4 : 0}>{chartData.map((entry, i) => <Cell key={entry.name} fill={data.bestsellers.length ? ['#9c6a4c', '#d6a48c', '#74836e', '#d6c5a6', '#8f88a5'][i % 5] : '#e9e4dc'} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="legend">{data.bestsellers.length ? data.bestsellers.map((item, i) => <div key={item.name}><span className="legend-dot" style={{ background: ['#9c6a4c', '#d6a48c', '#74836e', '#d6c5a6', '#8f88a5'][i % 5] }} /><span>{item.name}</span><strong>{item.quantity}</strong></div>) : <p className="chart-empty-note">Your top-selling styles will appear after the first sale.</p>}</div></div>
    </section></div></>;
}

function PointOfSale({ api, user, notify }) {
  const { data: products, loading, refresh } = useLoad(api, '/api/products');
  const [query, setQuery] = useState('');
  const [barcode, setBarcode] = useState('');
  const [cart, setCart] = useState([]);
  const [payment, setPayment] = useState('Cash');
  const [taxRate, setTaxRate] = useState(0);
  const [walletQrs, setWalletQrs] = useState({});
  const [saving, setSaving] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  useEffect(() => { api('/api/checkout-settings').then((settings) => { setTaxRate(Number(settings.tax_rate) || 0); setWalletQrs(settings); }).catch((err) => notify(err.message)); }, [api, notify]);
  const filtered = products.filter((item) => `${item.name} ${item.barcode} ${item.size}`.toLowerCase().includes(query.toLowerCase()));
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = subtotal * taxRate / 100;
  const add = (product) => {
    if (product.shop_qty < 1) return notify('This item is out of shop stock.');
    setCart((old) => {
      const found = old.find((item) => item.id === product.id);
      if (found) {
        if (found.quantity >= product.shop_qty) { notify('No more shop stock is available.'); return old; }
        return old.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...old, { ...product, quantity: 1 }];
    });
  };
  function scan(event) {
    event.preventDefault();
    const found = products.find((product) => product.barcode.toLowerCase() === barcode.trim().toLowerCase());
    if (found) add(found);
    else if (barcode.trim()) notify(`No item found for barcode “${barcode.trim()}”.`);
    setBarcode('');
  }
  async function checkout() {
    setSaving(true);
    try {
      const result = await api('/api/sales', { method: 'POST', body: JSON.stringify({ items: cart.map((item) => ({ productId: item.id, quantity: item.quantity })), paymentMethod: payment }) });
      setLastSale(result);
      setCart([]);
      await refresh();
      notify(`Sale #${result.id} completed.`);
    } catch (error) { notify(error.message); }
    finally { setSaving(false); }
  }
  return <div className="pos-page"><div className="pos-title-row"><div><p className="eyebrow">CHECKOUT COUNTER</p><h1>Point of sale</h1><p className="page-description">Scan a barcode or choose a style to add it to the sale.</p></div><div className="counter-chip"><span className="live-dot" /> Register ready <Clock3 size={15} /></div></div>
    <div className="pos-layout"><section className="panel product-browser"><form className="barcode-scan" onSubmit={scan}><div className="scan-icon"><QrCode size={20} /></div><input autoFocus value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Scan or enter barcode, then press Enter" aria-label="Barcode" /><button type="submit">Scan barcode</button></form>
      <div className="browser-toolbar"><div><h2>Shop collection</h2><span>{products.length} styles in stock</span></div><SearchInput value={query} onChange={setQuery} placeholder="Find a style" /></div>
      {loading ? <Loading /> : filtered.length ? <div className="product-grid">{filtered.map((product) => <button className="product-card" key={product.id} onClick={() => add(product)} disabled={product.shop_qty < 1}>
        <div className="product-image">{product.photo_url ? <img src={product.photo_url.startsWith('http') ? product.photo_url : product.photo_url} alt="" /> : <ShoppingBag size={26} />}<span className={product.shop_qty ? 'stock-tag' : 'stock-tag out'}>{product.shop_qty ? `${product.shop_qty} in shop` : 'Out of stock'}</span></div>
        <div className="product-card-info"><div><strong>{product.name}</strong><small>{product.size || 'One size'} · {product.barcode}</small></div><b>{currency.format(product.price)}</b></div>
      </button>)}</div> : <Empty title="No styles found" text="Try another search, or add products from Inventory." />}
    </section><aside className="panel cart-panel"><div className="cart-header"><div><h2>Current sale</h2><p>{cart.length} {cart.length === 1 ? 'style' : 'styles'} · {cart.reduce((sum, item) => sum + item.quantity, 0)} pieces</p></div><span className="cart-bag"><ShoppingBag size={18} /></span></div>
      {cart.length ? <div className="cart-items">{cart.map((item) => <div className="cart-item" key={item.id}><div className="cart-thumb">{item.photo_url ? <img src={item.photo_url} alt="" /> : <ShoppingBag size={16} />}</div><div className="cart-item-main"><strong>{item.name}</strong><small>{item.size || 'One size'} · {currency.format(item.price)}</small><div className="quantity-control"><button onClick={() => setCart((old) => old.flatMap((entry) => entry.id !== item.id ? [entry] : entry.quantity > 1 ? [{ ...entry, quantity: entry.quantity - 1 }] : []))}>−</button><span>{item.quantity}</span><button onClick={() => add(item)}>+</button></div></div><b>{currency.format(item.price * item.quantity)}</b><button className="remove-item" onClick={() => setCart((old) => old.filter((entry) => entry.id !== item.id))} aria-label={`Remove ${item.name}`}><X size={15} /></button></div>)}</div> : <div className="cart-empty"><div className="empty-icon"><ShoppingCart size={22} /></div><strong>Your sale is empty</strong><span>Scan a barcode or select a product to begin.</span></div>}
      <div className="checkout-box"><div className="summary-line"><span>Subtotal</span><strong>{currency.format(subtotal)}</strong></div>{taxRate > 0 && <div className="summary-line"><span>Tax · {taxRate}%</span><strong>{currency.format(tax)}</strong></div>}<div className="summary-line total-line"><span>Total due</span><strong>{currency.format(subtotal + tax)}</strong></div><label className="payment-label">Payment method<select value={payment} onChange={(e) => setPayment(e.target.value)}><option value="Cash">Cash</option><option value="KBZ Pay">KBZ Pay</option><option value="Wave Pay">Wave Pay</option><option value="AYA Pay">AYA Pay</option></select></label>{payment !== 'Cash' && <div className="checkout-qr">{walletQrs[walletSettingKey[payment]] ? <><strong>{payment}</strong><img src={walletQrs[walletSettingKey[payment]]} alt={`${payment} payment QR code`} /></> : <span>Ask your administrator to add the {payment} QR code in Settings.</span>}</div>}
        <button className="button primary checkout-button" disabled={!cart.length || saving} onClick={checkout}>{saving ? 'Completing…' : 'Complete sale'}<ArrowDownToLine size={17} /></button>
        {lastSale && <div className="last-sale"><Check size={14} /> Last receipt: #{lastSale.id} · {currency.format(lastSale.total)}</div>}
      </div>
    </aside></div>
  </div>;
}

function SalesRecords({ api, notify }) {
  const { data, loading } = useLoad(api, '/api/sales');
  const [query, setQuery] = useState('');
  const [exporting, setExporting] = useState(false);
  const filtered = data.filter((sale) => `${sale.id} ${sale.items} ${sale.cashier_name}`.toLowerCase().includes(query.toLowerCase()));
  async function exportSales() {
    setExporting(true);
    try {
      const rows = await api('/api/sales/export');
      await downloadWorkbook([{ name: 'Sales', rows }], 'atelier-sales.xlsx');
      notify('Sale records exported to Excel.');
    } catch (error) {
      notify(`Could not export sale records: ${error.message}`);
    } finally {
      setExporting(false);
    }
  }
  return <><PageHeading eyebrow="TRANSACTION HISTORY" title="Sale record" description="Every checkout, all in one place." action={<div className="heading-actions"><span className="period-chip"><Clock3 size={14} /> Latest 1,000 sales</span><Button variant="secondary" icon={FileSpreadsheet} onClick={exportSales} disabled={exporting}>{exporting ? 'Exporting…' : 'Export Excel'}</Button></div>} />
    <section className="panel table-panel"><div className="table-toolbar"><SearchInput value={query} onChange={setQuery} placeholder="Search item or cashier" /><span className="record-count">{filtered.length} records</span></div>{loading ? <Loading /> : filtered.length ? <div className="table-scroll"><table><thead><tr><th>SALE ID</th><th>ITEM NAME</th><th>CASHIER NAME</th><th>DATE &amp; TIME</th><th>PAYMENT</th><th>TOTAL</th></tr></thead><tbody>{filtered.map((sale) => <tr key={sale.id}><td><span className="sale-id">#{String(sale.id).padStart(4, '0')}</span></td><td className="item-cell">{sale.items || '—'}</td><td>{sale.cashier_name}</td><td>{formatDate(sale.created_at)}</td><td><span className="badge neutral">{sale.payment_method}</span></td><td className="amount-cell">{currency.format(sale.total)}</td></tr>)}</tbody></table></div> : <Empty title="No sales recorded" text="Completed checkouts will appear here." />}</section></>;
}

function Inventory({ api, notify }) {
  const products = useLoad(api, '/api/products');
  const purchases = useLoad(api, '/api/purchases');
  const suppliers = useLoad(api, '/api/suppliers');
  const [tab, setTab] = useState('inventory');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState('');
  const [edit, setEdit] = useState(null);
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const currentList = tab === 'inventory' ? products.data : purchases.data;
  const filtered = currentList.filter((item) => `${item.name || item.item_name} ${item.barcode || ''} ${item.supplier_name || ''}`.toLowerCase().includes(query.toLowerCase()));
  const productFields = [
    { name: 'barcode', label: 'Barcode', required: true }, { name: 'name', label: 'Item name', required: true },
    { name: 'photoUrl', label: 'Product photo', type: 'image', wide: true },
    { name: 'shopQty', label: 'Shop quantity', type: 'number', min: '0', required: true },
    { name: 'factoryQty', label: 'Factory quantity', type: 'number', min: '0', required: true },
    { name: 'size', label: 'Size / variants' }, { name: 'price', label: 'Selling price (MMK)', type: 'number', min: '0', step: '1', required: true },
  ];
  const purchaseFields = [
    { name: 'productId', label: 'Item', type: 'select', required: true, options: [{ value: '', label: 'Choose an item' }, ...products.data.map((p) => ({ value: p.id, label: `${p.name} · ${p.barcode}` }))] },
    { name: 'supplierId', label: 'Supplier', type: 'select', options: [{ value: '', label: 'No supplier selected' }, ...suppliers.data.map((s) => ({ value: s.id, label: s.name }))] },
    { name: 'quantity', label: 'Quantity received', type: 'number', min: '1', required: true }, { name: 'unitCost', label: 'Unit cost (MMK)', type: 'number', min: '0', step: '1' },
    { name: 'destination', label: 'Stock destination', type: 'select', required: true, options: [{ value: 'shop', label: 'Shop' }, { value: 'factory', label: 'Factory' }] },
  ];
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    try {
      if (modal === 'product') {
        const path = edit ? `/api/products/${edit.id}` : '/api/products';
        await api(path, { method: edit ? 'PUT' : 'POST', body: JSON.stringify(values) });
        await products.refresh();
        notify(edit ? 'Item updated.' : 'Item added to inventory.');
      } else {
        await api('/api/purchases', { method: 'POST', body: JSON.stringify(values) });
        await Promise.all([purchases.refresh(), products.refresh()]);
        notify('Purchase recorded and stock updated.');
      }
      setModal('');
    } catch (error) { notify(error.message); }
    finally { setBusy(false); }
  }
  async function remove(product) {
    if (!window.confirm(`Delete ${product.name} from inventory?`)) return;
    try { await api(`/api/products/${product.id}`, { method: 'DELETE' }); await products.refresh(); notify('Item removed.'); }
    catch (error) { notify(error.message); }
  }
  async function exportTab() {
    const rows = tab === 'inventory' ? products.data : purchases.data;
    try { await downloadWorkbook([{ name: tab === 'inventory' ? 'Inventory' : 'Purchases', rows }], `atelier-${tab}.xlsx`); }
    catch (error) { notify(`Could not export Excel file: ${error.message}`); }
  }
  return <><PageHeading eyebrow="STOCK & PROCUREMENT" title="Inventory" description="Keep your collection and incoming purchases up to date." action={<Button variant="secondary" icon={FileSpreadsheet} onClick={exportTab}>Export Excel</Button>} />
    <section className="panel table-panel"><div className="inventory-toolbar"><div className="tabs"><button className={tab === 'inventory' ? 'selected' : ''} onClick={() => setTab('inventory')}><Boxes size={15} />Inventory</button><button className={tab === 'purchases' ? 'selected' : ''} onClick={() => setTab('purchases')}><PackagePlus size={15} />Purchase list</button></div><div className="table-actions"><SearchInput value={query} onChange={setQuery} placeholder="Search inventory" />{tab === 'inventory' ? <Button onClick={() => { setEdit(null); setValues({ ...blank.product }); setModal('product'); }}>Add item</Button> : <Button onClick={() => { setValues({ ...blank.purchase }); setModal('purchase'); }}>Add purchase</Button>}</div></div>
      {tab === 'inventory' && <div className="inventory-note"><span><Store size={14} /> Shop stock</span><span><Boxes size={14} /> Factory stock</span><span className="note-separator" />Sales reduce shop stock. Purchases update the selected destination.</div>}
      {products.loading || purchases.loading ? <Loading /> : filtered.length ? <div className="table-scroll"><table><thead>{tab === 'inventory' ? <tr><th>BARCODE</th><th>ITEM</th><th>SIZE</th><th>SHOP QTY</th><th>FACTORY QTY</th><th>PRICE</th><th></th></tr> : <tr><th>PURCHASE ID</th><th>ITEM</th><th>SUPPLIER</th><th>QUANTITY</th><th>DESTINATION</th><th>UNIT COST</th><th>DATE</th></tr>}</thead><tbody>{tab === 'inventory' ? filtered.map((item) => <tr key={item.id}><td><span className="code">{item.barcode}</span></td><td><div className="table-product">{item.photo_url ? <img src={item.photo_url} alt="" /> : <span><ShoppingBag size={15} /></span>}<strong>{item.name}</strong></div></td><td>{item.size || '—'}</td><td><span className={Number(item.shop_qty) < 4 ? 'quantity-low' : ''}>{item.shop_qty} pcs</span></td><td>{item.factory_qty} pcs</td><td className="amount-cell">{currency.format(item.price)}</td><td><div className="row-actions"><button onClick={() => { setEdit(item); setValues({ barcode: item.barcode, name: item.name, photoUrl: item.photo_url || '', shopQty: item.shop_qty, factoryQty: item.factory_qty, size: item.size || '', price: item.price }); setModal('product'); }} aria-label="Edit item"><Edit3 size={15} /></button><button onClick={() => remove(item)} aria-label="Delete item"><Trash2 size={15} /></button></div></td></tr>)
        : filtered.map((purchase) => <tr key={purchase.id}><td><span className="sale-id">#{String(purchase.id).padStart(4, '0')}</span></td><td><div className="table-product"><span><ShoppingBag size={15} /></span><strong>{purchase.item_name}</strong></div><small className="sub-cell">{purchase.barcode}</small></td><td>{purchase.supplier_name || '—'}</td><td>{purchase.quantity} pcs</td><td><span className={`badge ${purchase.destination === 'shop' ? 'green-badge' : 'neutral'}`}>{purchase.destination}</span></td><td className="amount-cell">{currency.format(purchase.unit_cost)}</td><td>{formatDate(purchase.purchased_at)}</td></tr>)}</tbody></table></div> : <Empty title={tab === 'inventory' ? 'Your inventory is empty' : 'No purchases yet'} text={tab === 'inventory' ? 'Add your first style to start selling.' : 'Record a purchase to add stock to your shop or factory.'} />}
    </section>
    {modal && <Modal title={modal === 'purchase' ? 'Record a purchase' : edit ? 'Edit inventory item' : 'Add inventory item'} onClose={() => setModal('')} onSubmit={save} fields={modal === 'purchase' ? purchaseFields : productFields} values={values} setValues={setValues} busy={busy} api={api} />}
  </>;
}

const directoryConfig = {
  supplier: { endpoint: '/api/suppliers', title: 'Supplier list', eyebrow: 'YOUR PARTNERS', description: 'Supplier details are linked directly to your purchase records.', singular: 'supplier', icon: Truck, fields: [{ name: 'name', label: 'Supplier name', required: true }, { name: 'phone', label: 'Phone number' }, { name: 'email', label: 'Email address', type: 'email' }, { name: 'address', label: 'Address', type: 'textarea', wide: true }, { name: 'notes', label: 'Notes', type: 'textarea', wide: true }], columns: ['NAME', 'PHONE', 'EMAIL', 'ADDRESS'], values: (r) => [r.name, r.phone || '—', r.email || '—', r.address || '—'] },
  vip: { endpoint: '/api/vips', title: 'VIP list', eyebrow: 'CUSTOMER COMMUNITY', description: 'Recognize your regulars and keep their contact details close.', singular: 'VIP customer', icon: Heart, fields: [{ name: 'name', label: 'Customer name', required: true }, { name: 'phone', label: 'Phone number' }, { name: 'email', label: 'Email address', type: 'email' }, { name: 'points', label: 'Loyalty points', type: 'number', min: '0' }, { name: 'notes', label: 'Notes', type: 'textarea', wide: true }], columns: ['CUSTOMER', 'PHONE', 'EMAIL', 'POINTS', 'ADDED'], values: (r) => [r.name, r.phone || '—', r.email || '—', `${r.points} pts`, formatDate(r.created_at)] },
};
function Directory({ api, notify, kind }) {
  const config = directoryConfig[kind];
  const { data, loading, refresh } = useLoad(api, config.endpoint);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [values, setValues] = useState({});
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const records = data.filter((item) => JSON.stringify(item).toLowerCase().includes(search.toLowerCase()));
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api(editing ? `${config.endpoint}/${editing.id}` : config.endpoint, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(values) });
      await refresh();
      setModal(false);
      notify(`${config.singular} ${editing ? 'updated' : 'added'}.`);
    } catch (error) { notify(error.message); }
    finally { setBusy(false); }
  }
  async function remove(item) {
    if (!window.confirm(`Remove ${item.name}?`)) return;
    try { await api(`${config.endpoint}/${item.id}`, { method: 'DELETE' }); await refresh(); notify(`${config.singular} removed.`); }
    catch (error) { notify(error.message); }
  }
  return <><PageHeading eyebrow={config.eyebrow} title={config.title} description={config.description} action={<Button onClick={() => { setEditing(null); setValues({ ...blank[kind] }); setModal(true); }}>Add {config.singular}</Button>} />
    <section className="panel table-panel"><div className="table-toolbar"><SearchInput value={search} onChange={setSearch} placeholder={`Search ${config.singular}s`} /><span className="record-count">{records.length} {records.length === 1 ? 'record' : 'records'}</span></div>
      {loading ? <Loading /> : records.length ? <div className="table-scroll"><table><thead><tr>{config.columns.map((c) => <th key={c}>{c}</th>)}<th></th></tr></thead><tbody>{records.map((item) => <tr key={item.id}>{config.values(item).map((v, i) => <td key={i}>{i === 0 ? <strong>{v}</strong> : v}</td>)}<td><div className="row-actions"><button onClick={() => { setEditing(item); setValues(Object.fromEntries(Object.keys(blank[kind]).map((key) => [key, item[key] ?? '']))); setModal(true); }} aria-label={`Edit ${config.singular}`}><Edit3 size={15} /></button><button onClick={() => remove(item)} aria-label={`Delete ${config.singular}`}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div> : <Empty title={`No ${config.singular}s yet`} text={`Add a ${config.singular} to build your shop records.`} />}
    </section>{modal && <Modal title={`${editing ? 'Edit' : 'Add'} ${config.singular}`} onClose={() => setModal(false)} onSubmit={save} fields={config.fields} values={values} setValues={setValues} busy={busy} api={api} />}
  </>;
}

function Cashiers({ api, notify }) {
  const { data, loading, refresh } = useLoad(api, '/api/users');
  const [modal, setModal] = useState(false);
  const [values, setValues] = useState({ ...blank.cashier });
  const [busy, setBusy] = useState(false);
  async function add(event) {
    event.preventDefault();
    setBusy(true);
    try { await api('/api/users', { method: 'POST', body: JSON.stringify(values) }); await refresh(); setModal(false); setValues({ ...blank.cashier }); notify('Cashier account created.'); }
    catch (error) { notify(error.message); }
    finally { setBusy(false); }
  }
  async function toggle(cashier) {
    try { await api(`/api/users/${cashier.id}`, { method: 'PATCH', body: JSON.stringify({ active: !cashier.active }) }); await refresh(); notify(cashier.active ? 'Cashier access paused.' : 'Cashier access restored.'); }
    catch (error) { notify(error.message); }
  }
  return <><PageHeading eyebrow="TEAM ACCESS" title="Cashiers" description="Create and manage staff sign-in accounts." action={<Button onClick={() => setModal(true)}>Add cashier</Button>} />
    <section className="panel table-panel"><div className="table-toolbar"><span className="record-count">{data.length} staff accounts</span><span className="badge neutral"><Users size={13} /> Cashier access</span></div>{loading ? <Loading /> : data.length ? <div className="table-scroll"><table><thead><tr><th>NAME</th><th>STAFF ID</th><th>USERNAME</th><th>ACCESS</th><th>DATE ADDED</th><th></th></tr></thead><tbody>{data.map((cashier) => <tr key={cashier.id}><td><div className="name-with-avatar"><span className="avatar small-avatar">{cashier.full_name.slice(0, 1).toUpperCase()}</span><strong>{cashier.full_name}</strong></div></td><td><span className="code">{cashier.employee_code}</span></td><td>{cashier.username}</td><td><span className={`badge ${cashier.active ? 'green-badge' : 'neutral'}`}>{cashier.active ? 'Active' : 'Paused'}</span></td><td>{formatDate(cashier.created_at)}</td><td><button className={`text-action ${cashier.active ? 'pause' : ''}`} onClick={() => toggle(cashier)}>{cashier.active ? 'Pause access' : 'Restore access'}</button></td></tr>)}</tbody></table></div> : <Empty title="No cashiers yet" text="Add a cashier account so staff can sign in to the register." />}</section>
    {modal && <Modal title="Add cashier account" onClose={() => setModal(false)} onSubmit={add} values={values} setValues={setValues} busy={busy} api={api} fields={[{ name: 'employeeCode', label: 'Cashier staff ID', required: true, placeholder: 'e.g. CASHIER002' }, { name: 'fullName', label: 'Full name', required: true }, { name: 'username', label: 'Username', required: true }, { name: 'password', label: 'Cashier password', type: 'password', required: true, placeholder: 'At least 8 characters' }]} />}
  </>;
}

function Settings({ api, notify }) {
  const [tax, setTax] = useState('0');
  const [walletQrs, setWalletQrs] = useState({ kbz_pay_qr: '', wave_pay_qr: '', aya_pay_qr: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  useEffect(() => { api('/api/settings').then((settings) => { setTax(settings.tax_rate || '0'); setWalletQrs({ kbz_pay_qr: settings.kbz_pay_qr || '', wave_pay_qr: settings.wave_pay_qr || '', aya_pay_qr: settings.aya_pay_qr || '' }); }).catch((error) => notify(error.message)).finally(() => setLoading(false)); }, [api, notify]);
  async function uploadQr(settingKey, file) {
    if (!file) return;
    setUploading(true);
    try { const form = new FormData(); form.append('image', file); const result = await api('/api/upload', { method: 'POST', body: form }); setWalletQrs((current) => ({ ...current, [settingKey]: result.url })); }
    catch (error) { notify(error.message); }
    finally { setUploading(false); }
  }
  async function save() {
    setSaving(true);
    try { await api('/api/settings', { method: 'PUT', body: JSON.stringify({ tax_rate: tax, ...walletQrs }) }); notify('Shop settings saved.'); }
    catch (error) { notify(error.message); }
    finally { setSaving(false); }
  }
  async function changePassword(event) {
    event.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) return notify('The new passwords do not match.');
    setPasswordSaving(true);
    try {
      await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword }) });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      notify('Password changed successfully.');
    } catch (error) { notify(error.message); }
    finally { setPasswordSaving(false); }
  }
  async function exportAll() {
    setExporting(true);
    try {
      const [sales, products, purchases, suppliers, vips, cashiers] = await Promise.all(['/api/sales/export', '/api/products', '/api/purchases', '/api/suppliers', '/api/vips', '/api/users'].map((url) => api(url)));
      await downloadWorkbook([{ name: 'Sales', rows: sales }, { name: 'Inventory', rows: products }, { name: 'Purchases', rows: purchases }, { name: 'Suppliers', rows: suppliers }, { name: 'VIP Customers', rows: vips }, { name: 'Cashiers', rows: cashiers }], 'atelier-shop-export.xlsx');
      notify('All shop records exported to Excel.');
    } catch (error) { notify(error.message); }
    finally { setExporting(false); }
  }
  if (loading) return <Loading />;
  return <><PageHeading eyebrow="SHOP PREFERENCES" title="Settings" description="Manage tax, mobile payments, and shop data." />
    <div className="settings-layout"><section className="panel settings-card"><div className="settings-icon"><BadgePercent size={19} /></div><div className="settings-copy"><h2>Tax adjustments</h2><p>Set the tax rate applied to new sales at checkout.</p></div><label className="tax-control">Tax rate <div><input type="number" min="0" max="100" step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} /><span>%</span></div></label><div className="settings-foot"><span>Existing sale records won’t be changed.</span><Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</Button></div></section>
      <section className="panel settings-card wallet-settings-card"><div className="settings-icon"><QrCode size={19} /></div><div className="settings-copy"><h2>Mobile banking payment QR codes</h2><p>Add a separate QR code for each wallet. Cashiers see the matching code when they select that payment method.</p></div><div className="wallet-qr-grid">{walletOptions.map(({ name, key }) => <div className="wallet-qr-slot" key={key}><strong>{name}</strong>{walletQrs[key] ? <img src={walletQrs[key]} alt={`${name} QR code`} /> : <div className="qr-placeholder"><QrCode size={30} /><span>No QR uploaded</span></div>}<label className="button secondary upload-qr"><ImagePlus size={15} />{uploading ? 'Uploading…' : walletQrs[key] ? 'Replace QR' : 'Upload QR'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => uploadQr(key, e.target.files?.[0])} /></label></div>)}<div className="wallet-qr-save"><span>Save your QR codes to show them at cashier checkout.</span><Button onClick={save} disabled={saving || uploading}>{saving ? 'Saving…' : 'Save QR codes'}</Button></div></div></section>
      <form className="panel settings-card" onSubmit={changePassword}><div className="settings-icon"><UserRound size={19} /></div><div className="settings-copy"><h2>Change administrator password</h2><p>Use a unique password of at least 8 characters. Passwords are stored as bcrypt hashes.</p></div><div className="password-fields"><label>Current password<input type="password" autoComplete="current-password" required value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} /></label><label>New password<input type="password" autoComplete="new-password" minLength="8" required value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} /></label><label>Confirm new password<input type="password" autoComplete="new-password" minLength="8" required value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} /></label><Button type="submit" disabled={passwordSaving}>{passwordSaving ? 'Updating…' : 'Update password'}</Button></div></form>
      <section className="panel settings-card export-card"><div className="settings-icon"><FileSpreadsheet size={19} /></div><div className="settings-copy"><h2>Export shop data</h2><p>Download your sales, stock, purchases, suppliers, VIPs, and cashier list in one Excel workbook.</p></div><Button variant="secondary" icon={ArrowDownToLine} onClick={exportAll} disabled={exporting}>{exporting ? 'Preparing export…' : 'Export all records'}</Button></section>
    </div></>;
}

async function downloadWorkbook(sheets, filename) {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  const workbookSheets = sheets.map(({ name, rows }) => {
    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    return {
      sheet: name.slice(0, 31),
      data: rows.length ? [columns, ...rows.map((row) => columns.map((column) => row[column] ?? ''))] : [['No records']],
      stickyRowsCount: 1,
    };
  });
  const blob = await writeExcelFile(workbookSheets).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
function formatDate(value) {
  if (!value) return '—';
  const parsed = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
