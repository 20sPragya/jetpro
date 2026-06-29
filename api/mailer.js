'use strict';

const nodemailer = require('nodemailer');

const BRAND  = 'JetPro Media';
const ACCENT = '#ff5c2e';

let transporter;
let usingDevTransport = false;

function getTransporter() {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true'
        || Number(process.env.SMTP_PORT) === 465,
      auth:   process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  } else {
    usingDevTransport = true;
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }
  return transporter;
}

async function verifyTransport() {
  if (usingDevTransport || !process.env.SMTP_HOST) {
    console.log('[mailer] No SMTP_HOST set — DEV mode (emails logged, not sent).');
    return;
  }
  try {
    await getTransporter().verify();
    console.log('[mailer] SMTP connection verified.');
  } catch (err) {
    console.warn('[mailer] SMTP verify failed:', err.message);
  }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function notificationEmail(data) {
  const rows = [
    ['Name',            data.name],
    ['Email',           data.email],
    ['Brand / company', data.brand  || '—'],
    ['Budget',          data.budget || 'Not specified'],
  ].map(([k, v]) => `
    <tr>
      <td style="padding:6px 16px 6px 0;color:#8a8a90;font:600 12px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;white-space:nowrap;vertical-align:top">${esc(k)}</td>
      <td style="padding:6px 0;color:#111114;font:500 14px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif">${esc(v)}</td>
    </tr>`).join('');

  const html = `
  <div style="background:#f2f1ec;padding:28px">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e6e4dd;border-radius:16px;overflow:hidden">
      <div style="background:#0b0b0d;padding:20px 26px">
        <span style="color:#fff;font:800 16px/1 -apple-system,Segoe UI,Roboto,Arial,sans-serif;letter-spacing:-.02em">JetPro<span style="color:${ACCENT}"> Media</span></span>
        <span style="float:right;color:#65646b;font:700 11px/1.6 ui-monospace,Menlo,monospace;letter-spacing:.16em;text-transform:uppercase">New enquiry</span>
      </div>
      <div style="padding:26px">
        <h1 style="margin:0 0 4px;color:#111114;font:800 22px/1.1 -apple-system,Segoe UI,Roboto,Arial,sans-serif;letter-spacing:-.02em">New campaign enquiry</h1>
        <p style="margin:0 0 20px;color:#65646b;font:400 13px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif">A new lead just came in from the website contact form.</p>
        <table style="border-collapse:collapse;width:100%">${rows}</table>
        <div style="margin-top:18px;padding-top:18px;border-top:1px solid #eceae3">
          <div style="color:#8a8a90;font:600 12px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;margin-bottom:6px">Message</div>
          <div style="color:#111114;font:400 14px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif;white-space:pre-wrap">${esc(data.message)}</div>
        </div>
        <a href="mailto:${esc(data.email)}" style="display:inline-block;margin-top:22px;background:${ACCENT};color:#190600;text-decoration:none;font:700 13px/1 -apple-system,Segoe UI,Roboto,Arial,sans-serif;padding:13px 20px;border-radius:100px">Reply to ${esc(data.name)}</a>
      </div>
    </div>
  </div>`;

  const text =
    `New campaign enquiry\n\n` +
    `Name:   ${data.name}\n` +
    `Email:  ${data.email}\n` +
    `Brand:  ${data.brand  || '—'}\n` +
    `Budget: ${data.budget || 'Not specified'}\n\n` +
    `Message:\n${data.message}\n`;

  return { html, text };
}

function acknowledgementEmail(data) {
  const firstName = esc(data.name.split(' ')[0]);

  const html = `
  <div style="background:#f2f1ec;padding:28px">
    <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e6e4dd;border-radius:16px;overflow:hidden">
      <div style="background:#0b0b0d;padding:22px 28px">
        <span style="color:#fff;font:800 17px/1 -apple-system,Segoe UI,Roboto,Arial,sans-serif;letter-spacing:-.02em">JetPro<span style="color:${ACCENT}"> Media</span></span>
      </div>
      <div style="padding:28px">
        <h1 style="margin:0 0 12px;color:#111114;font:800 24px/1.1 -apple-system,Segoe UI,Roboto,Arial,sans-serif;letter-spacing:-.02em">Cleared for takeoff ✈</h1>
        <p style="margin:0 0 14px;color:#3a3a40;font:400 15px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif">Hi ${firstName}, thanks for reaching out to JetPro Media. We've got your campaign enquiry and a strategist will get back to you within one business day.</p>
        <p style="margin:0 0 22px;color:#3a3a40;font:400 15px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif">Here's a copy of what you sent us:</p>
        <div style="background:#f7f6f1;border:1px solid #eceae3;border-radius:12px;padding:16px 18px;color:#111114;font:400 14px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif;white-space:pre-wrap">${esc(data.message)}</div>
        <p style="margin:24px 0 0;color:#8a8a90;font:400 13px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif">— The JetPro Media team<br>info@jetpromedia.com</p>
      </div>
    </div>
  </div>`;

  const text =
    `Hi ${data.name.split(' ')[0]},\n\n` +
    `Thanks for reaching out to JetPro Media. We've got your campaign enquiry and ` +
    `will get back to you within one business day.\n\n` +
    `Your message:\n${data.message}\n\n` +
    `— The JetPro Media team\ninfo@jetpromedia.com\n`;

  return { html, text };
}

async function sendEnquiry(data) {
  const t    = getTransporter();
  const from = process.env.MAIL_FROM || `${BRAND} <no-reply@jetpromedia.com>`;
  const to   = process.env.MAIL_TO   || 'info@jetpromedia.com';

  const note = notificationEmail(data);
  const info = await t.sendMail({
    from,
    to,
    replyTo: `${data.name} <${data.email}>`,
    subject: `New campaign enquiry — ${data.name}${data.brand ? ' · ' + data.brand : ''}`,
    text:    note.text,
    html:    note.html,
  });

  if (usingDevTransport) {
    console.log('[mailer:DEV] Notification email (not sent — no SMTP_HOST set):');
    console.log(info.message.toString());
  }

  // acknowledgement to the sender — non-blocking
  try {
    const ack = acknowledgementEmail(data);
    await t.sendMail({
      from,
      to:      `${data.name} <${data.email}>`,
      subject: 'We got your enquiry — JetPro Media',
      text:    ack.text,
      html:    ack.html,
    });
  } catch (err) {
    console.warn('[mailer] Acknowledgement email failed:', err.message);
  }

  return info;
}

module.exports = { sendEnquiry, verifyTransport };
