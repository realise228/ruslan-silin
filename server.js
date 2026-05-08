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
  db.run('CREATE TABLE IF NOT EXISTS concerts (id INTEGER PRIMARY KEY AUTOINCREMENT, city TEXT, venue TEXT, date TEXT, time TEXT, ticket_url TEXT, description TEXT, created DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.run('CREATE TABLE IF NOT EXISTS subscribers (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE, created DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.run('CREATE TABLE IF NOT EXISTS gallery (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, file TEXT, created DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.run('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)');
  db.run('CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, phone TEXT, created DATETIME DEFAULT CURRENT_TIMESTAMP)');

  // Демо-данные
  const count = db.exec('SELECT COUNT(*) FROM tracks');
  if (!count.length || count[0].values[0][0] === 0) {
    db.run('INSERT INTO tracks (title, description, file, cover) VALUES (?,?,?,?)', ['Молитва', 'Победа на фестивале', 'https://music.yandex.ru/', '2.jpg']);
    db.run('INSERT INTO tracks (title, description, file, cover) VALUES (?,?,?,?)', ['Забирай рай', 'В исполнении Ани Лорак', 'https://music.yandex.ru/', '3.jpg']);
    db.run('INSERT INTO videos (title, description, youtube_url) VALUES (?,?,?)', ['Молитва (Live)', 'Выступление', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ']);
    db.run('INSERT INTO concerts (city, venue, date, time, ticket_url) VALUES (?,?,?,?,?)', ['Москва', 'Крокус Сити Холл', '15.06.2026', '19:00', '#']);
  }

  app.listen(port, () => console.log('Server running on port ' + port));
});

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const adminAuth = basicAuth({ users: { 'admin': 'music123' }, challenge: true });
app.use('/admin', adminAuth, express.static('admin'));

app.get('/api/tracks', (req, res) => {
  try { const r = db.exec('SELECT * FROM tracks ORDER BY created DESC'); res.json(r.length ? r[0].values.map(v => ({id:v[0],title:v[1],description:v[2],file:v[3],cover:v[4]})) : []); } catch(e) { res.json([]); }
});

app.get('/api/videos', (req, res) => {
  try { const r = db.exec('SELECT * FROM videos ORDER BY created DESC'); res.json(r.length ? r[0].values.map(v => ({id:v[0],title:v[1],description:v[2],youtube_url:v[3]})) : []); } catch(e) { res.json([]); }
});

app.get('/api/concerts', (req, res) => {
  try { const r = db.exec('SELECT * FROM concerts ORDER BY date ASC'); res.json(r.length ? r[0].values.map(v => ({id:v[0],city:v[1],venue:v[2],date:v[3],time:v[4],ticket_url:v[5],description:v[6]})) : []); } catch(e) { res.json([]); }
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
