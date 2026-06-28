'use strict';

const VALID_BUDGETS = new Set(['Under ₹50K', '₹50K–₹2L', '₹2L–₹5L', '₹5L+', '']);

// Strip control characters and CR/LF to prevent email header injection.
function sanitizeHeader(s) {
  return String(s || '').replace(/[\r\n\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').trim();
}

function isValidEmail(s) {
  return /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(s);
}

function validateLead(body) {
  // Honeypot: bots that fill this field are silently dropped.
  if (body && body.company_url) {
    return { ok: true, isSpam: true, errors: [], data: null };
  }

  const errors = [];

  const name    = sanitizeHeader(body && body.name).slice(0, 80);
  const email   = sanitizeHeader(body && body.email).slice(0, 254);
  const message = String((body && body.message) || '').trim().slice(0, 4100);
  const brand   = sanitizeHeader(body && body.brand).slice(0, 120);
  const budget  = sanitizeHeader(body && body.budget);

  if (name.length < 2) errors.push('Name must be at least 2 characters.');
  if (name.length > 80) errors.push('Name must be 80 characters or fewer.');
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

module.exports = { validateLead };
