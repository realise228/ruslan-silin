const express = require('express');
const multer = require('multer');
const basicAuth = require('express-basic-auth');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const app = express();
const port = process.env.PORT || 3000;
const DB_PATH = 'data.db';

let db;

async function startServer() {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
  }

  db.run('CREATE TABLE IF NOT EXISTS tracks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, file TEXT, cover TEXT, created DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.run('CREATE TABLE IF NOT EXISTS videos (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, youtube_url TEXT, created DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.run('CREATE TABLE IF NOT EXISTS concerts (id INTEGER PRIMARY KEY AUTOINCREMENT, city TEXT, venue TEXT, date TEXT, time TEXT, ticket_url TEXT, banner TEXT, description TEXT, created DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.run('CREATE TABLE IF NOT EXISTS subscribers (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE, created DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.run('CREATE TABLE IF NOT EXISTS gallery (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, file TEXT, created DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.run('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)');
  db.run('CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, phone TEXT, created DATETIME DEFAULT CURRENT_TIMESTAMP)');
  
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));

  if (!fs.existsSync('public/uploads')) fs.mkdirSync('public/uploads', { recursive: true });

  app.listen(port, () => console.log('Server: ' + port));
}

function saveDB() {
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

const adminAuth = basicAuth({ users: { 'ruslan505@yandex.ru': 'Rus_Silin_505' }, challenge: true });
app.use('/admin', adminAuth, express.static('admin'));

function rowsToObjects(result) {
  if (!result.length) return [];
  return result[0].values.map(row => {
    const obj = {};
    result[0].columns.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });
}

app.get('/api/tracks', (req, res) => { try { res.json(rowsToObjects(db.exec('SELECT * FROM tracks ORDER BY created DESC'))); } catch(e) { res.json([]); } });
app.get('/api/videos', (req, res) => { try { res.json(rowsToObjects(db.exec('SELECT * FROM videos ORDER BY created DESC'))); } catch(e) { res.json([]); } });
app.get('/api/concerts', (req, res) => { try { res.json(rowsToObjects(db.exec('SELECT * FROM concerts ORDER BY date ASC'))); } catch(e) { res.json([]); } });
app.get('/api/gallery', (req, res) => { try { res.json(rowsToObjects(db.exec('SELECT * FROM gallery ORDER BY created DESC'))); } catch(e) { res.json([]); } });
app.get('/api/design', (req, res) => { try { const rows = rowsToObjects(db.exec("SELECT * FROM settings WHERE key IN ('accent','bg','text','headingFont','bodyFont')")); const s = {}; rows.forEach(x => s[x.key] = x.value); res.json({accent:s.accent||'#cc0000',bg:s.bg||'#000000',text:s.text||'#ffffff',headingFont:s.headingFont||'Oswald',bodyFont:s.bodyFont||'Roboto Mono'}); } catch(e) { res.json({}); } });
app.get('/api/about', (req, res) => { try { const rows = rowsToObjects(db.exec("SELECT * FROM settings WHERE key IN ('about_text','stat1','stat1label','stat2','stat2label','stat3','stat3label')")); const s = {}; rows.forEach(x => s[x.key] = x.value); res.json({text:s.about_text||'',stat1:s.stat1||'150+',stat1label:s.stat1label||'ПЕСЕН',stat2:s.stat2||'15',stat2label:s.stat2label||'ЛЕТ',stat3:s.stat3||'3',stat3label:s.stat3label||'СЕЗОН'}); } catch(e) { res.json({}); } });

app.post('/api/admin/track', adminAuth, upload.single('cover'), (req, res) => {
  const { title, description, url } = req.body;
  const cover = req.file ? req.file.filename : '';
  db.run('INSERT INTO tracks (title, description, file, cover) VALUES (?,?,?,?)', [title||'', description||'', url||'', cover]);
  saveDB();
  res.redirect('/admin');
});
app.post('/api/admin/video', adminAuth, (req, res) => {
  const { title, description, youtube_url } = req.body;
  db.run('INSERT INTO videos (title, description, youtube_url) VALUES (?,?,?)', [title||'', description||'', youtube_url||'']);
  saveDB();
  res.redirect('/admin');
});
app.post('/api/admin/concert', adminAuth, upload.single('banner'), (req, res) => {
  const { city, venue, date, time, ticket_url, description } = req.body;
  const banner = req.file ? req.file.filename : '';
  db.run('INSERT INTO concerts (city, venue, date, time, ticket_url, banner, description) VALUES (?,?,?,?,?,?,?)', [city||'', venue||'', date||'', time||'', ticket_url||'', banner, description||'']);
  saveDB();
  res.redirect('/admin');
});
app.post('/api/admin/gallery', adminAuth, upload.single('image'), (req, res) => {
  const { title, description } = req.body;
  const file = req.file ? req.file.filename : '';
  db.run('INSERT INTO gallery (title, description, file) VALUES (?,?,?)', [title||'', description||'', file]);
  saveDB();
  res.redirect('/admin');
});
app.post('/api/admin/about', adminAuth, (req, res) => {
  db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('about_text', ?)", [req.body.text||'']);
  saveDB();
  res.json({ok:true});
});
app.post('/api/admin/design', adminAuth, (req, res) => {
  for (const k of Object.keys(req.body)) {
    db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [k, req.body[k]||'']);
  }
  saveDB();
  res.json({ok:true});
});
app.post('/api/subscribe', (req, res) => {
  try { db.run('INSERT INTO subscribers (email) VALUES (?)', [req.body.email]); saveDB(); } catch(e) {}
  res.json({ok:true});
});
app.post('/api/order', (req, res) => {
  const {name, email, phone} = req.body;
  db.run('INSERT INTO orders (name, email, phone) VALUES (?,?,?)', [name||'', email||'', phone||'']);
  saveDB();
  res.json({ok:true});
});

app.delete('/api/admin/track/:id', adminAuth, (req, res) => { db.run('DELETE FROM tracks WHERE id=?', [req.params.id]); saveDB(); res.json({ok:true}); });
app.delete('/api/admin/video/:id', adminAuth, (req, res) => { db.run('DELETE FROM videos WHERE id=?', [req.params.id]); saveDB(); res.json({ok:true}); });
app.delete('/api/admin/concert/:id', adminAuth, (req, res) => { db.run('DELETE FROM concerts WHERE id=?', [req.params.id]); saveDB(); res.json({ok:true}); });
app.delete('/api/admin/gallery/:id', adminAuth, (req, res) => { db.run('DELETE FROM gallery WHERE id=?', [req.params.id]); saveDB(); res.json({ok:true}); });

startServer();
