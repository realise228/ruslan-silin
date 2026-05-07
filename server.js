const express = require('express');
const multer = require('multer');
const initSqlJs = require('sql.js');
const basicAuth = require('express-basic-auth');
const fs = require('fs');

const app = express();
const port = 3000;

let db;
const DB_PATH = 'music.db';

initSqlJs().then(SQL => {
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  
  db.run('CREATE TABLE IF NOT EXISTS tracks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, file TEXT, cover TEXT, created DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.run('CREATE TABLE IF NOT EXISTS videos (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, youtube_url TEXT, created DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.run('CREATE TABLE IF NOT EXISTS concerts (id INTEGER PRIMARY KEY AUTOINCREMENT, city TEXT, venue TEXT, date TEXT, time TEXT, ticket_url TEXT, description TEXT, created DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.run('CREATE TABLE IF NOT EXISTS subscribers (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE, created DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.run('CREATE TABLE IF NOT EXISTS gallery (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, file TEXT, created DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.run('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)');
  db.run('CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, phone TEXT, created DATETIME DEFAULT CURRENT_TIMESTAMP)');
  
  saveDatabase();
  app.listen(port, () => console.log('http://localhost:'+port));
});

function saveDatabase() {
  if (db) fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

const storage = multer.diskStorage({
  destination: 'public/uploads/',
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'))
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('public/uploads'));
app.use('/images', express.static('public/images'));

const adminAuth = basicAuth({ users: { 'admin': 'music123' }, challenge: true });
app.use('/admin', adminAuth, express.static('admin'));

// GET APIs
app.get('/api/tracks', (req, res) => {
  try {
    const result = db.exec('SELECT * FROM tracks ORDER BY created DESC');
    const tracks = result.length ? result[0].values.map(r => ({id:r[0],title:r[1],description:r[2],file:r[3],cover:r[4]})) : [];
    res.json(tracks);
  } catch(e) { res.json([]); }
});

app.get('/api/videos', (req, res) => {
  try {
    const result = db.exec('SELECT * FROM videos ORDER BY created DESC');
    const videos = result.length ? result[0].values.map(r => ({id:r[0],title:r[1],description:r[2],youtube_url:r[3]})) : [];
    res.json(videos);
  } catch(e) { res.json([]); }
});

app.get('/api/concerts', (req, res) => {
  try {
    const result = db.exec('SELECT * FROM concerts ORDER BY date ASC');
    const concerts = result.length ? result[0].values.map(r => ({id:r[0],city:r[1],venue:r[2],date:r[3],time:r[4],ticket_url:r[5],description:r[6]})) : [];
    res.json(concerts);
  } catch(e) { res.json([]); }
});

app.get('/api/gallery', (req, res) => {
  try {
    const result = db.exec('SELECT * FROM gallery ORDER BY created DESC');
    const gallery = result.length ? result[0].values.map(r => ({id:r[0],title:r[1],description:r[2],file:r[3]})) : [];
    res.json(gallery);
  } catch(e) { res.json([]); }
});

app.get('/api/about', (req, res) => {
  const getSetting = (key, def) => {
    try { const r=db.exec('SELECT value FROM settings WHERE key=(?)',[key]); return r.length&&r[0].values.length?r[0].values[0][0]:def; } catch(e) { return def; }
  };
  res.json({
    text: getSetting('about_text',''),
    stat1: getSetting('stat1','150+'),
    stat1label: getSetting('stat1label','ПЕСЕН'),
    stat2: getSetting('stat2','15'),
    stat2label: getSetting('stat2label','ЛЕТ НА СЦЕНЕ'),
    stat3: getSetting('stat3','3'),
    stat3label: getSetting('stat3label','СЕЗОН ГОЛОС')
  });
});

app.get('/api/design', (req, res) => {
  const getSetting = (key, def) => {
    try { const r=db.exec('SELECT value FROM settings WHERE key=(?)',[key]); return r.length&&r[0].values.length?r[0].values[0][0]:def; } catch(e) { return def; }
  };
  res.json({
    accent: getSetting('accent','#cc0000'),
    bg: getSetting('bg','#000000'),
    text: getSetting('text','#ffffff'),
    headingFont: getSetting('headingFont','Oswald'),
    bodyFont: getSetting('bodyFont','Roboto Mono')
  });
});

// POST APIs
app.post('/api/admin/track', adminAuth, upload.fields([{ name: 'cover' }]), (req, res) => {
  const { title, description, url } = req.body;
  const cover = req.files['cover']?.[0]?.filename || null;
  const file = url || '';
  db.run('INSERT INTO tracks (title, description, file, cover) VALUES (?, ?, ?, ?)', [title, description, file, cover]);
  saveDatabase();
  res.redirect('/admin');
});

app.post('/api/admin/video', adminAuth, (req, res) => {
  const { title, description, youtube_url } = req.body;
  db.run('INSERT INTO videos (title, description, youtube_url) VALUES (?, ?, ?)', [title, description, youtube_url]);
  saveDatabase();
  res.redirect('/admin');
});

app.post('/api/admin/concert', adminAuth, (req, res) => {
  const { city, venue, date, time, ticket_url, description } = req.body;
  db.run('INSERT INTO concerts (city, venue, date, time, ticket_url, description) VALUES (?, ?, ?, ?, ?, ?)', [city, venue, date, time, ticket_url, description]);
  saveDatabase();
  res.redirect('/admin');
});

app.post('/api/admin/gallery', adminAuth, upload.single('image'), (req, res) => {
  const { title, description } = req.body;
  db.run('INSERT INTO gallery (title, description, file) VALUES (?, ?, ?)', [title||'', description||'', req.file.filename]);
  saveDatabase();
  res.redirect('/admin');
});

app.post('/api/admin/about', adminAuth, (req, res) => {
  db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['about_text', req.body.text]);
  saveDatabase();
  res.json({ok:true});
});

app.post('/api/admin/about/stats', adminAuth, (req, res) => {
  const d = req.body;
  ['stat1','stat1label','stat2','stat2label','stat3','stat3label'].forEach(k => {
    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [k, d[k]||'']);
  });
  saveDatabase();
  res.json({ok:true});
});

app.post('/api/admin/design', adminAuth, (req, res) => {
  const d = req.body;
  Object.keys(d).forEach(k => {
    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [k, d[k]||'']);
  });
  saveDatabase();
  res.json({ok:true});
});

app.post('/api/subscribe', (req, res) => {
  const { email } = req.body;
  try { db.run('INSERT INTO subscribers (email) VALUES (?)', [email]); saveDatabase(); } catch(e) {}
  res.json({ok:true});
});


// ORDER SONG
app.post('/api/order', (req, res) => {
  const {name, email, phone} = req.body;
  db.run('INSERT INTO orders (name, email, phone) VALUES (?, ?, ?)', [name, email, phone]);
  saveDatabase();
  res.json({ok:true});
});

app.get('/api/admin/orders', adminAuth, (req, res) => {
  try {
    const result = db.exec('SELECT * FROM orders ORDER BY created DESC');
    const orders = result.length ? result[0].values.map(r => ({id:r[0],name:r[1],email:r[2],phone:r[3],created:r[4]})) : [];
    res.json(orders);
  } catch(e) { res.json([]); }
});

// DELETE APIs

app.delete('/api/admin/track/:id', adminAuth, (req, res) => {
  try { db.run('DELETE FROM tracks WHERE id = ?', [req.params.id]); saveDatabase(); res.json({ok:true}); } catch(e) { res.status(500).json({error:e.message}); }
});

app.delete('/api/admin/video/:id', adminAuth, (req, res) => {
  try { db.run('DELETE FROM videos WHERE id = ?', [req.params.id]); saveDatabase(); res.json({ok:true}); } catch(e) { res.status(500).json({error:e.message}); }
});

app.delete('/api/admin/concert/:id', adminAuth, (req, res) => {
  try { db.run('DELETE FROM concerts WHERE id = ?', [req.params.id]); saveDatabase(); res.json({ok:true}); } catch(e) { res.status(500).json({error:e.message}); }
});

app.delete('/api/admin/gallery/:id', adminAuth, (req, res) => {
  try { db.run('DELETE FROM gallery WHERE id = ?', [req.params.id]); saveDatabase(); res.json({ok:true}); } catch(e) { res.status(500).json({error:e.message}); }
});
