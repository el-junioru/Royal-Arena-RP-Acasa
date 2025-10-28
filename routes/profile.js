// routes/profile.js
import path from 'path';
import fs from 'fs';
import express from 'express';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { pool } from '../db.js';
import { config } from '../config.js';
import { hashPassword } from '../auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const router = express.Router();

/* Storage: memorie, 2MB, doar imagini */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype || '');
    cb(ok ? null : new Error('format invalid'), ok);
  }
});

/* Tabela avatar BLOB */
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS profile_photos (
      login VARCHAR(64) PRIMARY KEY,
      mime  VARCHAR(64) NOT NULL,
      data  LONGBLOB     NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}
ensureTable().catch(()=>{});

/* Upload avatar */
router.post('/api/user/avatar', upload.single('avatar'), async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'unauthorized' });
  if (!req.file) return res.status(400).json({ error: 'fișier lipsă' });

  const login = req.session.user.login;
  const mime  = (req.file.mimetype || 'image/png').toLowerCase();

  try {
    await pool.query(
      `INSERT INTO profile_photos (login,mime,data) VALUES (?,?,?)
       ON DUPLICATE KEY UPDATE mime=VALUES(mime), data=VALUES(data)`,
      [login, mime, req.file.buffer]
    );

    const { table, idCol, avatarCol } = config.schema;
    if (table && idCol && avatarCol) {
      await pool.query(
        `UPDATE \`${table}\` SET \`${avatarCol}\`=? WHERE \`${idCol}\`=?`,
        [`/api/profile-photo/${login}.png`, login]
      );
    }
    res.json({ ok: true, url: `/api/profile-photo/me.png?ts=${Date.now()}` });
  } catch (e) {
    console.error('avatar upload', e?.message);
    res.status(500).json({ error: 'Eroare server' });
  }
});

/* Update email/parolă */
router.post('/api/user/update', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'unauthorized' });
  const { email, password } = req.body || {};
  const s = config.schema;
  try {
    if (email) {
      await pool.query(
        `UPDATE \`${s.table}\` SET \`${s.emailCol}\`=? WHERE \`${s.idCol}\`=?`,
        [String(email).trim(), req.session.user.login]
      );
      req.session.user.email = String(email).trim();
    }
    if (password && String(password).length >= 6) {
      const hp = await hashPassword(String(password));
      await pool.query(
        `UPDATE \`${s.table}\` SET \`${s.passwordCol}\`=? WHERE \`${s.idCol}\`=?`,
        [hp, req.session.user.login]
      );
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('user update', e?.message);
    res.status(500).json({ error: 'Eroare update' });
  }
});

/* Redirect avatarul curent al utilizatorului logat */
router.get('/api/profile-photo/me.png', (req, res) => {
  if (!req.session.user) return res.status(401).end();
  res.redirect(302, `/api/profile-photo/${encodeURIComponent(req.session.user.login)}.png?ts=${Date.now()}`);
});

/* Servire avatar din DB sau fallback */
router.get('/api/profile-photo/:login.png', async (req, res) => {
  try {
    const [[row]] = await pool.query(
      'SELECT mime,data FROM profile_photos WHERE login=? LIMIT 1',
      [req.params.login]
    );
    if (!row) {
      const fb = path.join(__dirname, '..', 'public', 'assets', 'no-pfp.svg');
      return res.sendFile(fb);
    }
    res.set('Content-Type', row.mime || 'image/png');
    res.set('Cache-Control', 'no-store');
    res.send(row.data);
  } catch (e) {
    console.error('profile-photo', e?.message);
    const fb = path.join(__dirname, '..', 'public', 'assets', 'no-pfp.svg');
    res.sendFile(fb);
  }
});

export default router;
