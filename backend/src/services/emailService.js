const nodemailer = require('nodemailer');
const config = require('../config/env');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!config.smtp.host || !config.smtp.user || !config.smtp.pass) {
    return null;
  }
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port || 587,
    secure: false,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });
  return transporter;
}

async function sendViaBrevoApi({ to, subject, html, text }) {
  const apiKey = config.brevoApiKey;
  if (!apiKey) return null;

  const fromEmail = config.smtp.fromEmail || 'noreply@smartscan.local';
  const fromName = config.smtp.fromName || 'SMARTSCAN';

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      sender: { name: fromName, email: fromEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo API error ${res.status}: ${body}`);
  }
  return res.json();
}

async function sendEmail({ to, subject, html, text }) {
  // 1) Prefer Brevo HTTP API
  if (config.brevoApiKey) {
    const result = await sendViaBrevoApi({ to, subject, html, text });
    console.log(`[SMARTSCAN] OTP/email sent via Brevo API → ${to}`);
    return result;
  }

  // 2) Brevo SMTP (smtp-relay.brevo.com)
  const tx = getTransporter();
  if (tx) {
    const result = await tx.sendMail({
      from: config.smtp.from,
      to,
      subject,
      html,
      text,
    });
    console.log(`[SMARTSCAN] OTP/email sent via Brevo SMTP → ${to}`);
    return result;
  }

  const err = new Error(
    'Brevo is not configured. Add BREVO_API_KEY (or SMTP_USER + SMTP_PASS) in backend/.env so registration OTP can be emailed.'
  );
  err.status = 503;
  throw err;
}

function otpTitle(purpose) {
  if (purpose === 'PIN_CREATE') return 'SMARTSCAN — Confirm your new payment PIN';
  if (purpose === 'PIN_RESET') return 'SMARTSCAN — Confirm payment PIN reset';
  if (purpose === 'RESET_PASSWORD') return 'SMARTSCAN — Reset your password';
  return 'SMARTSCAN — Verify your email';
}

async function sendOtpEmail(email, otp, purpose = 'REGISTER') {
  const title = otpTitle(purpose);
  const isPin = purpose === 'PIN_CREATE' || purpose === 'PIN_RESET';
  const isReset = purpose === 'RESET_PASSWORD';
  const footer = isPin
    ? 'After verification, an administrator must approve your payment PIN before you can pay.'
    : isReset
      ? 'Use this code on the forgot password page to set a new password.'
      : 'After verifying, an administrator may need to approve your account before you can log in.';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0f172a;color:#f8fafc;border-radius:12px">
      <h1 style="color:#2dd4bf;margin:0 0 8px">SMARTSCAN</h1>
      <p style="color:#cbd5e1">IoT Mall Shopping & Billing</p>
      <h2 style="margin:24px 0 8px">${title}</h2>
      <p>Your verification code is:</p>
      <div style="font-size:32px;letter-spacing:8px;font-weight:bold;background:#1e293b;padding:16px;text-align:center;border-radius:8px;color:#2dd4bf">${otp}</div>
      <p style="color:#94a3b8;margin-top:16px">This code expires in ${config.otpExpiresMinutes} minutes. Do not share it with anyone.</p>
      <p style="color:#94a3b8;font-size:12px">${footer}</p>
    </div>
  `;
  return sendEmail({
    to: email,
    subject: title,
    html,
    text: `Your SMARTSCAN code is ${otp}. Expires in ${config.otpExpiresMinutes} minutes.`,
  });
}

async function sendPinStatusEmail(email, fullName, status, requestType = 'CREATE') {
  const approved = status === 'APPROVED';
  const subject = approved
    ? 'SMARTSCAN — Payment PIN approved'
    : 'SMARTSCAN — Payment PIN request rejected';
  const action = requestType === 'RESET' ? 'PIN reset' : 'payment PIN';
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0f172a;color:#f8fafc;border-radius:12px">
      <h1 style="color:#2dd4bf;margin:0 0 8px">SMARTSCAN</h1>
      <h2 style="margin:24px 0 8px">${approved ? 'PIN approved' : 'PIN request rejected'}</h2>
      <p>Hello ${fullName || 'Customer'},</p>
      <p>Your ${action} request was <strong>${status}</strong> by an administrator.</p>
      ${
        approved
          ? '<p>You can now use your PIN to authorize RFID payments.</p>'
          : '<p>Please create or reset your PIN again from your profile.</p>'
      }
    </div>
  `;
  return sendEmail({
    to: email,
    subject,
    html,
    text: `Your SMARTSCAN ${action} was ${status}.`,
  });
}

module.exports = { sendEmail, sendOtpEmail, sendPinStatusEmail };
