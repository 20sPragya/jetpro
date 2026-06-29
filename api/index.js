'use strict';

require('dotenv').config();

const path    = require('path');
const express = require('express');
const helmet  = require('helmet');
const rateLimit = require('express-rate-limit');

const { validateLead }             = require('./validate');
const { sendEnquiry, verifyTransport } = require('./mailer');

const app = express();

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src':     ["'self'"],
      'script-src':      ["'self'", "'unsafe-inline'"],
      'style-src':       ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src':        ["'self'", 'https://fonts.gstatic.com'],
      'img-src':         ["'self'", 'data:'],
      'connect-src':     ["'self'"],
      'frame-ancestors': ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(express.json({ limit: '32kb' }));

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many enquiries from this address. Please try again later.' },
});

app.get('/api/health', (_req, res) =>
  res.json({ ok: true, service: 'jetpro-media', time: new Date().toISOString() }));

app.post('/api/contact', contactLimiter, async (req, res) => {
  const { ok, errors, isSpam, data } = validateLead(req.body);

  if (isSpam) {
    console.log('[contact] Honeypot triggered — dropping silently.');
    return res.status(200).json({ ok: true });
  }

  if (!ok) {
    return res.status(400).json({ ok: false, error: errors[0], errors });
  }

  try {
    await sendEnquiry(data);
    return res.status(200).json({ ok: true, message: 'Enquiry received.' });
  } catch (err) {
    console.error('[contact] Failed to send enquiry:', err);
    return res.status(502).json({
      ok: false,
      error: "We couldn't send your enquiry right now. Please email info@jetpromedia.com.",
    });
  }
});

// Static serving (used in local dev; Vercel CDN handles this in production).
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));

app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use((err, _req, res, _next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, error: 'Invalid request body.' });
  }
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ ok: false, error: 'Something went wrong.' });
});

module.exports = app;
