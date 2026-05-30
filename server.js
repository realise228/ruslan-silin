const express = require('express');
const multer = require('multer');
const basicAuth = require('express-basic-auth');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@libsql/client');

const app = express();
const port = process.env.PORT || 3000;

// Turso клиент
const db = createClient({
  url: 'libsql://ruslan-silin-realise228.aws-eu-west-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODAxNTYxOTQsImlkIjoiMDE5ZTc5OTItMDkwMS03NjBlLWE0MTUtZDQ4OGY2YzI1MmI1IiwicmlkIjoiNTI4YTZiOTEtMmRhMy00YWJiLTg3MTEtNzA5NmRmY2FlYzk1In0.4pBWSSWawJNDyYubfGaAeXmP5RL4_CxZYoAbuhydOLmGtsH6ssj6GXeIKFTxcMGDDvLUCt2u4bVw2WNp-t4HAg'
});

async function initDB() {
  await db.execute(`CREATE TABLE IF NOT EXISTS tracks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, file TEXT, cover TEXT, created DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS videos (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, youtube_url TEXT, created DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS concerts (id INTEGER PRIMARY KEY AUTOINCREMENT, city TEXT, venue TEXT, date TEXT, time TEXT, ticket_url TEXT, banner TEXT, description TEXT, created DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS subscribers (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE, created DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS gallery (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, file TEXT, created DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, phone TEXT, created DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  console.log('Turso DB ready');
}

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('public/uploads'));
app.use('/images', express.static('public/images'));

const adminAuth = basicAuth({ users: { 'ruslan505@yandex.ru': 'Rus_Silin_505' }, challenge: true });
app.use('/admin', adminAuth, express.static('admin'));

app.get('/api/tracks', async (req, res) => {
  try { const r = await db.execute('SELECT * FROM tracks ORDER BY created DESC'); res.json(r.rows); } catch(e) { res.json([]); }
});
app.get('/api/videos', async (req, res) => {
  try { const r = await db.execute('SELECT * FROM videos ORDER BY created DESC'); res.json(r.rows); } catch(e) { res.json([]); }
});
app.get('/api/concerts', async (req, res) => {
  try { const r = await db.execute('SELECT * FROM concerts ORDER BY date ASC'); res.json(r.rows); } catch(e) { res.json([]); }
});
app.get('/api/gallery', async (req, res) => {
  try { const r = await db.execute('SELECT * FROM gallery ORDER BY created DESC'); res.json(r.rows); } catch(e) { res.json([]); }
});
app.get('/api/design', async (req, res) => {
  try { const r = await db.execute("SELECT * FROM settings WHERE key IN ('accent','bg','text','headingFont','bodyFont')"); const s={}; r.rows.forEach(x=>s[x.key]=x.value); res.json({accent:s.accent||'#cc0000',bg:s.bg||'#000000',text:s.text||'#ffffff',headingFont:s.headingFont||'Oswald',bodyFont:s.bodyFont||'Roboto Mono'}); } catch(e) { res.json({}); }
});
app.get('/api/about', async (req, res) => {
  try { const r = await db.execute("SELECT * FROM settings WHERE key IN ('about_text','stat1','stat1label','stat2','stat2label','stat3','stat3label')"); const s={}; r.rows.forEach(x=>s[x.key]=x.value); res.json({text:s.about_text||'',stat1:s.stat1||'150+',stat1label:s.stat1label||'ПЕСЕН',stat2:s.stat2||'15',stat2label:s.stat2label||'ЛЕТ',stat3:s.stat3||'3',stat3label:s.stat3label||'СЕЗОН'}); } catch(e) { res.json({}); }
});

app.post('/api/admin/track', adminAuth, upload.fields([{ name: 'cover' }]), async (req, res) => {
  const { title, description, url } = req.body;
  const cover = req.files['cover']?.[0]?.originalname || null;
  await db.execute('INSERT INTO tracks (title, description, file, cover) VALUES (?,?,?,?)', [title, description, url, cover]);
  res.redirect('/admin');
});
app.post('/api/admin/video', adminAuth, async (req, res) => {
  const { title, description, youtube_url } = req.body;
  await db.execute('INSERT INTO videos (title, description, youtube_url) VALUES (?,?,?)', [title, description, youtube_url]);
  res.redirect('/admin');
});
app.post('/api/admin/concert', adminAuth, async (req, res) => {
  const { city, venue, date, time, ticket_url, description } = req.body;
  await db.execute('INSERT INTO concerts (city, venue, date, time, ticket_url, description) VALUES (?,?,?,?,?,?)', [city, venue, date, time, ticket_url, description]);
  res.redirect('/admin');
});
app.post('/api/admin/gallery', adminAuth, async (req, res) => {
  const { title, description } = req.body;
  await db.execute('INSERT INTO gallery (title, description, file) VALUES (?,?,?)', [title||'', description||'', '']);
  res.redirect('/admin');
});
app.post('/api/admin/about', adminAuth, async (req, res) => {
  await db.execute("INSERT INTO settings (key, value) VALUES ('about_text', ?) ON CONFLICT(key) DO UPDATE SET value=?", [req.body.text, req.body.text]);
  res.json({ok:true});
});
app.post('/api/admin/design', adminAuth, async (req, res) => {
  for (const k of Object.keys(req.body)) {
    await db.execute("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=?", [k, req.body[k], req.body[k]]);
  }
  res.json({ok:true});
});
app.post('/api/subscribe', async (req, res) => {
  try { await db.execute('INSERT INTO subscribers (email) VALUES (?)', [req.body.email]); } catch(e) {}
  res.json({ok:true});
});
app.post('/api/order', async (req, res) => {
  const {name, email, phone} = req.body;
  await db.execute('INSERT INTO orders (name, email, phone) VALUES (?,?,?)', [name,email,phone]);
  res.json({ok:true});
});

app.delete('/api/admin/track/:id', adminAuth, async (req, res) => {
  await db.execute('DELETE FROM tracks WHERE id=?', [req.params.id]);
  res.json({ok:true});
});
app.delete('/api/admin/video/:id', adminAuth, async (req, res) => {
  await db.execute('DELETE FROM videos WHERE id=?', [req.params.id]);
  res.json({ok:true});
});
app.delete('/api/admin/concert/:id', adminAuth, async (req, res) => {
  await db.execute('DELETE FROM concerts WHERE id=?', [req.params.id]);
  res.json({ok:true});
});
app.delete('/api/admin/gallery/:id', adminAuth, async (req, res) => {
  await db.execute('DELETE FROM gallery WHERE id=?', [req.params.id]);
  res.json({ok:true});
});

initDB().then(() => app.listen(port, () => console.log('Server: ' + port)));
