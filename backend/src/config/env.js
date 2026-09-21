require('dotenv').config();

function parseFrom(from) {
  const match = String(from || '').match(/^(.*?)\s*<([^>]+)>$/);
  if (match) {
    return { fromName: match[1].trim() || 'SMARTSCAN', fromEmail: match[2].trim() };
  }
  if (String(from || '').includes('@')) {
    return { fromName: 'SMARTSCAN', fromEmail: from.trim() };
  }
  return { fromName: 'SMARTSCAN', fromEmail: 'noreply@smartscan.local' };
}

const emailFrom = process.env.EMAIL_FROM || 'SMARTSCAN <noreply@smartscan.local>';
const parsedFrom = parseFrom(emailFrom);
const DEFAULT_JWT_SECRET = 'smartscan_jwt_secret_change_in_production_2026';

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
const extraOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const localhostOrigins = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'];
const isLocalhostOrigin = (origin) => {
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return ['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname);
  } catch {
    return false;
  }
};

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl,
  allowedOrigins: [...new Set([frontendUrl, ...extraOrigins, ...localhostOrigins])],
  isLocalhostOrigin,
  jwtSecret: process.env.JWT_SECRET || DEFAULT_JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  otpExpiresMinutes: Number(process.env.OTP_EXPIRES_MINUTES || 10),
  otpRateLimitMinutes: Number(process.env.OTP_RATE_LIMIT_MINUTES || 1),
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  brevoApiKey: process.env.BREVO_API_KEY || '',
  smtp: {
    host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || process.env.BREVO_SMTP_USER || '',
    pass: process.env.SMTP_PASS || process.env.BREVO_SMTP_KEY || '',
    from: parsedFrom.fromEmail.includes('@')
      ? `${process.env.BREVO_SENDER_NAME || parsedFrom.fromName} <${process.env.BREVO_SENDER_EMAIL || parsedFrom.fromEmail}>`
      : emailFrom,
    fromName: process.env.BREVO_SENDER_NAME || parsedFrom.fromName,
    fromEmail: process.env.BREVO_SENDER_EMAIL || parsedFrom.fromEmail,
  },
  iotApiKey: process.env.IOT_API_KEY || 'smartscan-iot-device-key-2026',
};
