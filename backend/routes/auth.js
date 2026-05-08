const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { signToken, authRequired } = require('../middleware/auth');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later.' }
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/signup', authLimiter, async (req, res) => {
  const { email, password, displayName } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  try {
    const hash = await bcrypt.hash(password, 12);
    const result = db
      .prepare(
        'INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)'
      )
      .run(email.toLowerCase(), hash, displayName || null);

    const token = signToken({ sub: result.lastInsertRowid, email: email.toLowerCase() });
    return res.status(201).json({
      token,
      user: {
        id: result.lastInsertRowid,
        email: email.toLowerCase(),
        displayName: displayName || null
      }
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Could not create account.' });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = db
    .prepare('SELECT id, email, password_hash, display_name FROM users WHERE email = ?')
    .get(email.toLowerCase());

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = signToken({ sub: user.id, email: user.email });
  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name
    }
  });
});

router.get('/me', authRequired, (req, res) => {
  const user = db
    .prepare('SELECT id, email, display_name FROM users WHERE id = ?')
    .get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  return res.json({
    id: user.id,
    email: user.email,
    displayName: user.display_name
  });
});

router.get('/locations', authRequired, (req, res) => {
  const rows = db
    .prepare(
      'SELECT id, label, latitude, longitude FROM saved_locations WHERE user_id = ? ORDER BY created_at DESC'
    )
    .all(req.user.id);
  res.json(rows);
});

router.post('/locations', authRequired, (req, res) => {
  const { label, latitude, longitude } = req.body || {};
  if (!label || typeof latitude !== 'number' || typeof longitude !== 'number') {
    return res.status(400).json({ error: 'label, latitude, and longitude are required.' });
  }
  const result = db
    .prepare(
      'INSERT INTO saved_locations (user_id, label, latitude, longitude) VALUES (?, ?, ?, ?)'
    )
    .run(req.user.id, label, latitude, longitude);
  res.status(201).json({ id: result.lastInsertRowid, label, latitude, longitude });
});

router.delete('/locations/:id', authRequired, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id.' });
  const result = db
    .prepare('DELETE FROM saved_locations WHERE id = ? AND user_id = ?')
    .run(id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found.' });
  res.status(204).end();
});

module.exports = router;
