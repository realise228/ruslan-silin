const express = require('express');
const multer = require('multer');
const initSqlJs = require('sql.js');
const basicAuth = require('express-basic-auth');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;
let db;

initSqlJs().then(SQL => {
  db = new SQL.Database();
  db.run('CREATE TABLE IF NOT EXISTS tracks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, file TEXT, cover TEXT, created DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.run('CREATE TABLE IF NOT EXISTS videos (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, youtube_url TEXT, created DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.run('CREATE TABLE IF NOT EXISTS concerts (id INTEGER PRIMARY KEY AUTOINCREMENT, city TEXT, venue TEXT, date TEXT, time TEXT, ticket_url TEXT, banner TEXT, description TEXT, created DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.run('CREATE TABLE IF NOT EXISTS subscribers (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE, created DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.run('CREATE TABLE IF NOT EXISTS gallery (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, file TEXT, created DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.run('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)');
  db.run('CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, phone TEXT, created DATETIME DEFAULT CURRENT_TIMESTAMP)');

  app.listen(port, () => console.log('Server running on port ' + port));
});

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
app.get('/admin', adminAuth, (req, res) => res.sendFile(path.join(__dirname, 'admin', 'index.html')));
app.use('/admin', adminAuth, express.static('admin'));

app.get('/api/tracks', (req, res) => {
  try { const r = db.exec('SELECT * FROM tracks ORDER BY created DESC'); res.json(r.length ? r[0].values.map(v => ({id:v[0],title:v[1],description:v[2],file:v[3],cover:v[4]})) : []); } catch(e) { res.json([]); }
});

app.get('/api/videos', (req, res) => {
  try { const r = db.exec('SELECT * FROM videos ORDER BY created DESC'); res.json(r.length ? r[0].values.map(v => ({id:v[0],title:v[1],description:v[2],youtube_url:v[3]})) : []); } catch(e) { res.json([]); }
});

app.get('/api/concerts', (req, res) => {
  try { const r = db.exec('SELECT id, city, venue, date, time, ticket_url, banner, description FROM concerts ORDER BY date ASC'); res.json(r.length ? r[0].values.map(v => ({id:v[0],city:v[1],venue:v[2],date:v[3],time:v[4],ticket_url:v[5],banner:v[6],description:v[7]})) : []); } catch(e) { res.json([]); }
});

app.get('/api/gallery', (req, res) => {
  try { const r = db.exec('SELECT * FROM gallery ORDER BY created DESC'); res.json(r.length ? r[0].values.map(v => ({id:v[0],title:v[1],description:v[2],file:v[3]})) : []); } catch(e) { res.json([]); }
});

app.get('/api/design', (req, res) => {
  const get = (k,d) => { try { const r=db.exec('SELECT value FROM settings WHERE key=(?)',[k]); return r.length&&r[0].values.length?r[0].values[0][0]:d; } catch(e) { return d; }};
  res.json({accent:get('accent','#cc0000'),bg:get('bg','#000000'),text:get('text','#ffffff'),headingFont:get('headingFont','Oswald'),bodyFont:get('bodyFont','Roboto Mono')});
});

app.get('/api/about', (req, res) => {
  const get = (k,d) => { try { const r=db.exec('SELECT value FROM settings WHERE key=(?)',[k]); return r.length&&r[0].values.length?r[0].values[0][0]:d; } catch(e) { return d; }};
  res.json({text:get('about_text',''),stat1:get('stat1','150+'),stat1label:get('stat1label','ПЕСЕН'),stat2:get('stat2','15'),stat2label:get('stat2label','ЛЕТ'),stat3:get('stat3','3'),stat3label:get('stat3label','СЕЗОН')});
});

app.get('/api/admin/orders', adminAuth, (req, res) => {
  try { const r = db.exec('SELECT * FROM orders ORDER BY created DESC'); res.json(r.length ? r[0].values.map(v => ({id:v[0],name:v[1],email:v[2],phone:v[3],created:v[4]})) : []); } catch(e) { res.json([]); }
});

app.post('/api/subscribe', (req, res) => {
  try { db.run('INSERT INTO subscribers (email) VALUES (?)', [req.body.email]); } catch(e) {}
  res.json({ok:true});
});

app.post('/api/order', (req, res) => {
  const {name, email, phone} = req.body;
  if (!name||!email||!phone) return res.status(400).json({error:1});
  db.run('INSERT INTO orders (name, email, phone) VALUES (?,?,?)', [name,email,phone]);
  res.json({ok:true});
});

app.post('/api/admin/about', adminAuth, (req, res) => {
  db.run('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)', ['about_text',req.body.text]);
  res.json({ok:true});
});

app.post('/api/admin/about/stats', adminAuth, (req, res) => {
  const d=req.body;
  Object.keys(d).forEach(k => db.run('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)', [k, d[k]||'']));
  res.json({ok:true});
});

app.post('/api/admin/design', adminAuth, (req, res) => {
  const d=req.body;
  Object.keys(d).forEach(k => db.run('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)', [k, d[k]||'']));
  res.json({ok:true});
});

app.post('/api/admin/track', adminAuth, upload.fields([{ name: 'cover' }]), (req, res) => {
  const { title, description, url } = req.body;
  const cover = req.files['cover']?.[0]?.filename || null;
  db.run('INSERT INTO tracks (title, description, file, cover) VALUES (?, ?, ?, ?)', [title, description, url, cover]);
  res.redirect('/admin');
});

app.post('/api/admin/video', adminAuth, (req, res) => {
  const { title, description, youtube_url } = req.body;
  db.run('INSERT INTO videos (title, description, youtube_url) VALUES (?, ?, ?)', [title, description, youtube_url]);
  res.redirect('/admin');
});

app.post('/api/admin/concert', adminAuth, upload.single('banner'), (req, res) => {
  const { city, venue, date, time, ticket_url, description } = req.body;
  const banner = req.file ? req.file.filename : null;
  db.run('INSERT INTO concerts (city, venue, date, time, ticket_url, banner, description) VALUES (?, ?, ?, ?, ?, ?, ?)', [city, venue, date, time, ticket_url, banner, description]);
  res.redirect('/admin');
});

app.post('/api/admin/gallery', adminAuth, upload.single('image'), (req, res) => {
  const { title, description } = req.body;
  db.run('INSERT INTO gallery (title, description, file) VALUES (?, ?, ?)', [title||'', description||'', req.file.filename]);
  res.redirect('/admin');
});

app.delete('/api/admin/track/:id', adminAuth, (req, res) => {
  db.run('DELETE FROM tracks WHERE id = ?', [req.params.id]);
  res.json({ok:true});
});

app.delete('/api/admin/video/:id', adminAuth, (req, res) => {
  db.run('DELETE FROM videos WHERE id = ?', [req.params.id]);
  res.json({ok:true});
});

app.delete('/api/admin/concert/:id', adminAuth, (req, res) => {
  db.run('DELETE FROM concerts WHERE id = ?', [req.params.id]);
  res.json({ok:true});
});

app.delete('/api/admin/gallery/:id', adminAuth, (req, res) => {
  db.run('DELETE FROM gallery WHERE id = ?', [req.params.id]);
  res.json({ok:true});
});
