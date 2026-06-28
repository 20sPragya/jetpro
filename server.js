'use strict';

require('dotenv').config();

const path    = require('path');
const express = require('express');
const helmet  = require('helmet');
const rateLimit = require('express-rate-limit');

const { validateLead }            = require('./src/validate');
const { sendEnquiry, verifyTransport } = require('./src/mailer');

const app  = express();
const PORT = Number(process.env.PORT || 3000);

// Behind a proxy (Render / Railway / Fly / Heroku) so rate-limit sees real client IPs.
app.set('trust proxy', 1);

// ---------- security headers ----------
// CSP allows inline <style>/<script> and Google Fonts (needed by the static site).
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src':  ["'self'"],
      'script-src':   ["'self'", "'unsafe-inline'"],
      'style-src':    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src':     ["'self'", 'https://fonts.gstatic.com'],
      'img-src':      ["'self'", 'data:'],
      'connect-src':  ["'self'"],
      'frame-ancestors': ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(express.json({ limit: '32kb' }));

// ---------- rate limit: 5 submissions per IP per 15 min ----------
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many enquiries from this address. Please try again later.' },
});

// ---------- API ----------
app.get('/api/health', (_req, res) =>
  res.json({ ok: true, service: 'jetpro-media', time: new Date().toISOString() }));

app.post('/api/contact', contactLimiter, async (req, res) => {
  const { ok, errors, isSpam, data } = validateLead(req.body);

  // Honeypot tripped — return 200 so bots learn nothing.
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

// ---------- static site ----------
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// Fallback: any non-API GET serves index.html.
app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------- error handler ----------
app.use((err, _req, res, _next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, error: 'Invalid request body.' });
  }
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ ok: false, error: 'Something went wrong.' });
});

// Only start the HTTP server when run directly (not when imported by Vercel).
if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`\n  JetPro Media server → http://localhost:${PORT}\n`);
    await verifyTransport();
  });
}

module.exports = app;
