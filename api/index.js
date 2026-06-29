'use strict';

require('dotenv').config();

const path      = require('path');
const express   = require('express');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');

// ─── validate ────────────────────────────────────────────────────────────────

const VALID_BUDGETS = new Set(['Under ₹50K', '₹50K–₹2L', '₹2L–₹5L', '₹5L+', '']);

function sanitizeHeader(s) {
  return String(s || '').replace(/[\r\n\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').trim();
}

function isValidEmail(s) {
  return /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(s);
}

function validateLead(body) {
  if (body && body.company_url) {
    return { ok: true, isSpam: true, errors: [], data: null };
  }
  const errors  = [];
  const name    = sanitizeHeader(body && body.name).slice(0, 80);
  const email   = sanitizeHeader(body && body.email).slice(0, 254);
  const message = String((body && body.message) || '').trim().slice(0, 4100);
  const brand   = sanitizeHeader(body && body.brand).slice(0, 120);
  const budget  = sanitizeHeader(body && body.budget);

  if (name.length < 2)     errors.push('Name must be at least 2 characters.');
  if (name.length > 80)    errors.push('Name must be 80 characters or fewer.');
  if (!isValidEmail(email)) errors.push('Please enter a valid email address.');
  if (message.length < 10) errors.push('Message must be at least 10 characters.');
  if (message.length > 4000) errors.push('Message must be 4000 characters or fewer.');
  if (budget && !VALID_BUDGETS.has(budget)) errors.push('Invalid budget selection.');

  return {
    ok: errors.length === 0,
    isSpam: false,
    errors,
    data: errors.length === 0 ? { name, email, message, brand, budget } : null,
  };
}

// ─── mailer ──────────────────────────────────────────────────────────────────

const BRAND  = 'JetPro Media';
const ACCENT = '#ff5c2e';
let _transporter;
let _devMode = false;

function getTransporter() {
  if (_transporter) return _transporter;
  if (process.env.SMTP_HOST) {
    _transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true'
        || Number(process.env.SMTP_PORT) === 465,
      auth:   process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  } else {
    _devMode = true;
    _transporter = nodemailer.createTransport({ jsonTransport: true });
  }
  return _transporter;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function notificationEmail(data) {
  const rows = [
    ['Name', data.name], ['Email', data.email],
    ['Brand / company', data.brand || '—'], ['Budget', data.budget || 'Not specified'],
  ].map(([k, v]) => `<tr>
    <td style="padding:6px 16px 6px 0;color:#8a8a90;font:600 12px/1.4 -apple-system,sans-serif;white-space:nowrap;vertical-align:top">${esc(k)}</td>
    <td style="padding:6px 0;color:#111114;font:500 14px/1.5 -apple-system,sans-serif">${esc(v)}</td>
  </tr>`).join('');

  return {
    html: `<div style="background:#f2f1ec;padding:28px"><div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e6e4dd;border-radius:16px;overflow:hidden">
      <div style="background:#0b0b0d;padding:20px 26px"><span style="color:#fff;font:800 16px/1 -apple-system,sans-serif">JetPro<span style="color:${ACCENT}"> Media</span></span><span style="float:right;color:#65646b;font:700 11px/1.6 ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase">New enquiry</span></div>
      <div style="padding:26px"><h1 style="margin:0 0 4px;color:#111114;font:800 22px/1.1 -apple-system,sans-serif">New campaign enquiry</h1><p style="margin:0 0 20px;color:#65646b;font:400 13px/1.5 -apple-system,sans-serif">A new lead just came in from the website contact form.</p>
      <table style="border-collapse:collapse;width:100%">${rows}</table>
      <div style="margin-top:18px;padding-top:18px;border-top:1px solid #eceae3"><div style="color:#8a8a90;font:600 12px/1.4 -apple-system,sans-serif;margin-bottom:6px">Message</div><div style="color:#111114;font:400 14px/1.6 -apple-system,sans-serif;white-space:pre-wrap">${esc(data.message)}</div></div>
      <a href="mailto:${esc(data.email)}" style="display:inline-block;margin-top:22px;background:${ACCENT};color:#190600;text-decoration:none;font:700 13px/1 -apple-system,sans-serif;padding:13px 20px;border-radius:100px">Reply to ${esc(data.name)}</a></div></div></div>`,
    text: `New campaign enquiry\n\nName: ${data.name}\nEmail: ${data.email}\nBrand: ${data.brand || '—'}\nBudget: ${data.budget || 'Not specified'}\n\nMessage:\n${data.message}\n`,
  };
}

function acknowledgementEmail(data) {
  const first = esc(data.name.split(' ')[0]);
  return {
    html: `<div style="background:#f2f1ec;padding:28px"><div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e6e4dd;border-radius:16px;overflow:hidden">
      <div style="background:#0b0b0d;padding:22px 28px"><span style="color:#fff;font:800 17px/1 -apple-system,sans-serif">JetPro<span style="color:${ACCENT}"> Media</span></span></div>
      <div style="padding:28px"><h1 style="margin:0 0 12px;color:#111114;font:800 24px/1.1 -apple-system,sans-serif">Cleared for takeoff ✈</h1>
      <p style="margin:0 0 14px;color:#3a3a40;font:400 15px/1.6 -apple-system,sans-serif">Hi ${first}, thanks for reaching out to JetPro Media. We've got your campaign enquiry and a strategist will get back to you within one business day.</p>
      <div style="background:#f7f6f1;border:1px solid #eceae3;border-radius:12px;padding:16px 18px;color:#111114;font:400 14px/1.6 -apple-system,sans-serif;white-space:pre-wrap">${esc(data.message)}</div>
      <p style="margin:24px 0 0;color:#8a8a90;font:400 13px/1.6 -apple-system,sans-serif">— The JetPro Media team<br>info@jetpromedia.com</p></div></div></div>`,
    text: `Hi ${data.name.split(' ')[0]},\n\nThanks for reaching out to JetPro Media. We'll get back to you within one business day.\n\nYour message:\n${data.message}\n\n— The JetPro Media team\ninfo@jetpromedia.com\n`,
  };
}

async function sendEnquiry(data) {
  const t    = getTransporter();
  const from = process.env.MAIL_FROM || `${BRAND} <no-reply@jetpromedia.com>`;
  const to   = process.env.MAIL_TO   || 'info@jetpromedia.com';
  const note = notificationEmail(data);

  const info = await t.sendMail({
    from, to,
    replyTo: `${data.name} <${data.email}>`,
    subject: `New campaign enquiry — ${data.name}${data.brand ? ' · ' + data.brand : ''}`,
    text: note.text, html: note.html,
  });

  if (_devMode) {
    console.log('[mailer:DEV] Notification email (not sent — no SMTP_HOST):');
    console.log(info.message.toString());
  }

  try {
    const ack = acknowledgementEmail(data);
    await t.sendMail({
      from, to: `${data.name} <${data.email}>`,
      subject: 'We got your enquiry — JetPro Media',
      text: ack.text, html: ack.html,
    });
  } catch (err) {
    console.warn('[mailer] Acknowledgement failed:', err.message);
  }
  return info;
}

// ─── express app ─────────────────────────────────────────────────────────────

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
  windowMs: 15 * 60 * 1000, max: 5,
  standardHeaders: true, legacyHeaders: false,
  message: { ok: false, error: 'Too many enquiries from this address. Please try again later.' },
});

app.get('/api/health', (_req, res) =>
  res.json({ ok: true, service: 'jetpro-media', time: new Date().toISOString() }));

app.post('/api/contact', contactLimiter, async (req, res) => {
  const { ok, errors, isSpam, data } = validateLead(req.body);
  if (isSpam) return res.status(200).json({ ok: true });
  if (!ok)    return res.status(400).json({ ok: false, error: errors[0], errors });
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

app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));
app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use((err, _req, res, _next) => {
  if (err && err.type === 'entity.parse.failed')
    return res.status(400).json({ ok: false, error: 'Invalid request body.' });
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ ok: false, error: 'Something went wrong.' });
});

module.exports = app;
