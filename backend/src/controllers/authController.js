const { supabase } = require('../config/supabase');
const config = require('../config/env');
const { sendOtpEmail } = require('../services/emailService');
const { writeAudit } = require('../services/auditService');
const {
  hashPassword,
  comparePassword,
  signToken,
  generateOtp,
  hashOtp,
  compareOtp,
  generateCode,
} = require('../utils/security');

async function getRoleId(roleName) {
  const { data, error } = await supabase.from('roles').select('id').eq('name', roleName).single();
  if (error || !data) throw new Error(`Role ${roleName} not found. Run schema.sql first.`);
  return data.id;
}

async function createAndSendOtp(userId, email, purpose) {
  const since = new Date(Date.now() - config.otpRateLimitMinutes * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('email_otps')
    .select('*', { count: 'exact', head: true })
    .eq('email', email)
    .eq('purpose', purpose)
    .gte('created_at', since);

  if ((count || 0) >= 3) {
    const err = new Error('Too many OTP requests. Please wait a minute.');
    err.status = 429;
    throw err;
  }

  const otp = generateOtp();
  const otpHash = await hashOtp(otp);
  const expiresAt = new Date(Date.now() + config.otpExpiresMinutes * 60 * 1000).toISOString();

  await supabase.from('email_otps').insert({
    user_id: userId,
    email,
    otp_hash: otpHash,
    purpose,
    expires_at: expiresAt,
    used: false,
  });

  await sendOtpEmail(email, otp, purpose);
  return true;
}

function publicUser(user, roleName, extras = {}) {
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    phone: user.phone,
    address: user.address,
    nationalId: user.national_id,
    profileImage: user.profile_image,
    role: roleName,
    emailVerified: user.email_verified,
    accountStatus: user.account_status,
    supermarketId: user.supermarket_id,
    branchId: user.branch_id,
    supermarketName: extras.supermarketName || user.supermarkets?.name || null,
    hasPaymentPin: Boolean(user.payment_pin_hash) && user.payment_pin_status === 'APPROVED',
    paymentPinStatus: user.payment_pin_status || 'NONE',
  };
}

exports.register = async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      address,
      nationalId,
      password,
      confirmPassword,
      role = 'CUSTOMER',
      supermarketName,
      supermarketAddress,
      supermarketPhone,
      supermarketEmail,
      supermarketDescription,
      branchName,
    } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const allowedSelfRoles = ['CUSTOMER', 'MANAGER'];
    const roleName = allowedSelfRoles.includes(role) ? role : 'CUSTOMER';
    if (roleName === 'MANAGER' && !String(supermarketName || '').trim()) {
      return res.status(400).json({ success: false, message: 'Supermarket name is required' });
    }

    const { data: existing } = await supabase.from('users').select('id').eq('email', email.toLowerCase()).maybeSingle();
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const roleId = await getRoleId(roleName);
    const passwordHash = await hashPassword(password);

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        full_name: fullName,
        email: email.toLowerCase(),
        phone: phone || null,
        address: address || supermarketAddress || null,
        national_id: nationalId || null,
        password_hash: passwordHash,
        profile_image: req.file ? `/uploads/${req.file.filename}` : null,
        role_id: roleId,
        email_verified: false,
        account_status: 'PENDING_APPROVAL',
        is_active: true,
      })
      .select('*')
      .single();

    if (error) throw error;

    if (roleName === 'MANAGER') {
      const { data: market, error: marketErr } = await supabase
        .from('supermarkets')
        .insert({
          name: String(supermarketName).trim(),
          description: supermarketDescription || null,
          address: supermarketAddress || address || null,
          phone: supermarketPhone || phone || null,
          email: (supermarketEmail || email).toLowerCase(),
          owner_id: user.id,
          status: 'PENDING_APPROVAL',
        })
        .select('*')
        .single();
      if (marketErr) throw marketErr;

      const branchCode = generateCode('BRANCH');
      const qrPayload = `SMARTSCAN_BRANCH:${branchCode}`;
      const { data: branch, error: branchErr } = await supabase
        .from('branches')
        .insert({
          supermarket_id: market.id,
          name: branchName || `${String(supermarketName).trim()} Main Branch`,
          code: branchCode,
          address: supermarketAddress || address || null,
          qr_payload: qrPayload,
          status: 'PENDING_APPROVAL',
        })
        .select('*')
        .single();
      if (branchErr) throw branchErr;

      await supabase
        .from('users')
        .update({ supermarket_id: market.id, branch_id: branch.id })
        .eq('id', user.id);
    }

    await createAndSendOtp(user.id, user.email, 'REGISTER');
    await writeAudit({
      userId: user.id,
      action: 'REGISTER',
      entityType: 'users',
      entityId: user.id,
      ip: req.ip,
    });

    return res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify your email to continue.',
      data: { email: user.email, role: roleName },
    });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({ success: false, message: err.message || 'Registration failed' });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp, purpose = 'REGISTER' } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }
    if (purpose === 'LOGIN') {
      return res.status(400).json({
        success: false,
        message: 'Login does not use OTP. Sign in with email and password only.',
      });
    }
    if (purpose !== 'REGISTER') {
      return res.status(400).json({
        success: false,
        message: 'Use the payment-pin verify endpoint for PIN OTPs.',
      });
    }

    const { data: records } = await supabase
      .from('email_otps')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('purpose', 'REGISTER')
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1);

    const record = records?.[0];
    if (!record) {
      return res.status(400).json({ success: false, message: 'No active OTP found. Request a new one.' });
    }
    if (new Date(record.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP expired. Please resend.' });
    }
    if (record.attempts >= 5) {
      return res.status(400).json({ success: false, message: 'Too many invalid attempts. Resend OTP.' });
    }

    const valid = await compareOtp(String(otp), record.otp_hash);
    if (!valid) {
      await supabase.from('email_otps').update({ attempts: record.attempts + 1 }).eq('id', record.id);
      return res.status(400).json({ success: false, message: 'Incorrect OTP' });
    }

    await supabase.from('email_otps').update({ used: true }).eq('id', record.id);

    const { data: user } = await supabase
      .from('users')
      .select('*, roles(name)')
      .eq('email', email.toLowerCase())
      .single();

    await supabase.from('users').update({ email_verified: true }).eq('id', user.id);

    if (user.roles?.name === 'CUSTOMER') {
      const cardUid = `RFID-${generateCode('CARD').split('-').slice(-1)[0]}`;
      await supabase.from('customer_cards').upsert(
        {
          customer_id: user.id,
          card_uid: cardUid,
          balance: 0,
          status: 'ACTIVE',
        },
        { onConflict: 'customer_id' }
      );
    }

    return res.json({
      success: true,
      message: 'Email verified. Waiting for administrator approval before login.',
      data: { emailVerified: true, accountStatus: 'PENDING_APPROVAL' },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'OTP verification failed' });
  }
};

exports.resendOtp = async (req, res) => {
  try {
    const { email, purpose = 'REGISTER' } = req.body;
    if (purpose === 'LOGIN') {
      return res.status(400).json({
        success: false,
        message: 'Login does not use OTP. Use email and password only.',
      });
    }
    const allowed = ['REGISTER', 'PIN_CREATE', 'PIN_RESET', 'RESET_PASSWORD'];
    if (!allowed.includes(purpose)) {
      return res.status(400).json({ success: false, message: 'Invalid verification purpose' });
    }
    const { data: user } = await supabase.from('users').select('id, email').eq('email', email?.toLowerCase()).maybeSingle();
    if (!user) return res.status(404).json({ success: false, message: 'Account not found' });
    await createAndSendOtp(user.id, user.email, purpose);
    return res.json({ success: true, message: 'Verification code resent to your email' });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const email = String(req.body.email || '')
      .trim()
      .toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const { data: user } = await supabase
      .from('users')
      .select('id, email, full_name, is_active')
      .eq('email', email)
      .maybeSingle();

    // Always return success-style message to avoid email enumeration, but still send when found
    if (!user || !user.is_active) {
      return res.json({
        success: true,
        message: 'If this email is registered, a reset code has been sent.',
        data: { email },
      });
    }

    await createAndSendOtp(user.id, user.email, 'RESET_PASSWORD');
    await writeAudit({
      userId: user.id,
      action: 'FORGOT_PASSWORD_REQUEST',
      entityType: 'users',
      entityId: user.id,
      ip: req.ip,
    });

    return res.json({
      success: true,
      message: 'Reset code sent to your email. Check your inbox.',
      data: { email: user.email },
    });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({ success: false, message: err.message || 'Could not send reset code' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const email = String(req.body.email || '')
      .trim()
      .toLowerCase();
    const { code, password, confirmPassword } = req.body;

    if (!email || !code || !password) {
      return res.status(400).json({ success: false, message: 'Email, code and new password are required' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const { data: user } = await supabase.from('users').select('id, email').eq('email', email).maybeSingle();
    if (!user) {
      return res.status(404).json({ success: false, message: 'Account not found for this email' });
    }

    const { data: records } = await supabase
      .from('email_otps')
      .select('*')
      .eq('email', email)
      .eq('purpose', 'RESET_PASSWORD')
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1);

    const record = records?.[0];
    if (!record) {
      return res.status(400).json({ success: false, message: 'No active reset code. Request a new one.' });
    }
    if (new Date(record.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: 'Reset code expired. Request a new one.' });
    }
    if (record.attempts >= 5) {
      return res.status(400).json({ success: false, message: 'Too many invalid attempts. Request a new code.' });
    }

    const valid = await compareOtp(String(code), record.otp_hash);
    if (!valid) {
      await supabase.from('email_otps').update({ attempts: record.attempts + 1 }).eq('id', record.id);
      return res.status(400).json({ success: false, message: 'Incorrect reset code' });
    }

    await supabase.from('email_otps').update({ used: true }).eq('id', record.id);

    const passwordHash = await hashPassword(String(password));
    await supabase.from('users').update({ password_hash: passwordHash }).eq('id', user.id);

    await writeAudit({
      userId: user.id,
      action: 'PASSWORD_RESET',
      entityType: 'users',
      entityId: user.id,
      ip: req.ip,
    });

    return res.json({
      success: true,
      message: 'Password updated successfully. You can now sign in.',
      data: { email: user.email },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Password reset failed' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*, roles(name)')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (error || !user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const ok = await comparePassword(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    if (!user.email_verified) {
      return res.status(403).json({
        success: false,
        message: 'Email not verified. Complete registration OTP first.',
        code: 'EMAIL_NOT_VERIFIED',
        data: { email: user.email },
      });
    }
    if (!['APPROVED', 'ACTIVE'].includes(user.account_status) && user.roles.name !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Account pending administrator approval',
        code: 'PENDING_APPROVAL',
      });
    }
    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account is inactive' });
    }

    // Login uses email + password only (no OTP)
    const token = signToken({ id: user.id, role: user.roles.name, email: user.email });
    return res.json({
      success: true,
      message: 'Login successful',
      data: { token, user: publicUser(user, user.roles.name) },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Login failed' });
  }
};

exports.me = async (req, res) => {
  let { data: user, error } = await supabase
    .from('users')
    .select('*, roles(name), supermarkets(id, name)')
    .eq('id', req.user.id)
    .single();

  if (error || !user) {
    const fallback = await supabase
      .from('users')
      .select('*, roles(name)')
      .eq('id', req.user.id)
      .single();
    user = fallback.data;
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  }

  const roleName = user.roles?.name;

  // Keep admin account platform-only — clear accidental store binding from display/context
  if (roleName === 'ADMIN' && user.supermarket_id) {
    await supabase.from('users').update({ supermarket_id: null, branch_id: null }).eq('id', user.id);
    user.supermarket_id = null;
    user.branch_id = null;
    user.supermarkets = null;
  }

  let supermarketName = user.supermarkets?.name || null;
  if (!supermarketName && user.supermarket_id && roleName !== 'ADMIN') {
    const { data: market } = await supabase
      .from('supermarkets')
      .select('name')
      .eq('id', user.supermarket_id)
      .maybeSingle();
    supermarketName = market?.name || null;
  }

  return res.json({
    success: true,
    data: publicUser(user, roleName, {
      supermarketName: roleName === 'ADMIN' ? null : supermarketName,
    }),
  });
};

exports.setPaymentPin = async (req, res) => {
  // Legacy alias → request flow
  return exports.requestPaymentPin(req, res);
};

exports.requestPaymentPin = async (req, res) => {
  try {
    const { pin, confirmPin, currentPassword, requestType } = req.body;
    if (!/^\d{4,6}$/.test(String(pin || ''))) {
      return res.status(400).json({ success: false, message: 'PIN must be 4-6 digits' });
    }
    if (String(pin) !== String(confirmPin || pin)) {
      return res.status(400).json({ success: false, message: 'PIN confirmation does not match' });
    }

    const { data: user } = await supabase.from('users').select('*').eq('id', req.user.id).single();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const ok = await comparePassword(currentPassword, user.password_hash);
    if (!ok) return res.status(401).json({ success: false, message: 'Password incorrect' });

    const type =
      requestType === 'RESET' || (user.payment_pin_hash && user.payment_pin_status === 'APPROVED')
        ? 'RESET'
        : 'CREATE';

    // Cancel any open requests
    await supabase
      .from('pin_requests')
      .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .in('status', ['PENDING_OTP', 'PENDING_APPROVAL']);

    const pinHash = await hashPassword(String(pin));
    const { data: request, error } = await supabase
      .from('pin_requests')
      .insert({
        user_id: user.id,
        request_type: type,
        pin_hash: pinHash,
        status: 'PENDING_OTP',
      })
      .select('*')
      .single();
    if (error) throw error;

    // CREATE: mark pending. RESET: keep current APPROVED PIN active until admin approves the new one.
    if (type === 'CREATE') {
      await supabase.from('users').update({ payment_pin_status: 'PENDING_APPROVAL' }).eq('id', user.id);
    }

    await createAndSendOtp(user.id, user.email, type === 'RESET' ? 'PIN_RESET' : 'PIN_CREATE');

    await writeAudit({
      userId: user.id,
      action: type === 'RESET' ? 'PIN_RESET_REQUESTED' : 'PIN_CREATE_REQUESTED',
      entityType: 'pin_requests',
      entityId: request.id,
      ip: req.ip,
    });

    return res.json({
      success: true,
      message:
        'OTP sent to your email. Verify the code, then wait for administrator approval before the PIN can be used for payments.',
      data: {
        requestId: request.id,
        requestType: type,
        email: user.email,
        purpose: type === 'RESET' ? 'PIN_RESET' : 'PIN_CREATE',
        requiresOtp: true,
        requiresAdminApproval: true,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.verifyPaymentPinOtp = async (req, res) => {
  try {
    const { otp, purpose } = req.body;
    const otpPurpose = purpose === 'PIN_RESET' ? 'PIN_RESET' : 'PIN_CREATE';

    const { data: user } = await supabase.from('users').select('*').eq('id', req.user.id).single();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const { data: records } = await supabase
      .from('email_otps')
      .select('*')
      .eq('email', user.email)
      .eq('purpose', otpPurpose)
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1);

    const record = records?.[0];
    if (!record) {
      return res.status(400).json({ success: false, message: 'No active PIN OTP found. Request again.' });
    }
    if (new Date(record.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP expired. Please resend.' });
    }
    if (record.attempts >= 5) {
      return res.status(400).json({ success: false, message: 'Too many invalid attempts. Resend OTP.' });
    }

    const valid = await compareOtp(String(otp), record.otp_hash);
    if (!valid) {
      await supabase.from('email_otps').update({ attempts: record.attempts + 1 }).eq('id', record.id);
      return res.status(400).json({ success: false, message: 'Incorrect OTP' });
    }

    await supabase.from('email_otps').update({ used: true }).eq('id', record.id);

    const { data: request } = await supabase
      .from('pin_requests')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'PENDING_OTP')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!request) {
      return res.status(400).json({ success: false, message: 'No pending PIN request found' });
    }

    await supabase
      .from('pin_requests')
      .update({
        status: 'PENDING_APPROVAL',
        otp_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', request.id);

    if (request.request_type === 'CREATE') {
      await supabase.from('users').update({ payment_pin_status: 'PENDING_APPROVAL' }).eq('id', user.id);
    }

    return res.json({
      success: true,
      message:
        'Email verified. Your payment PIN is waiting for administrator approval. You cannot pay until it is approved.',
      data: { requestId: request.id, status: 'PENDING_APPROVAL' },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.resendPaymentPinOtp = async (req, res) => {
  try {
    const { data: user } = await supabase.from('users').select('*').eq('id', req.user.id).single();
    const { data: request } = await supabase
      .from('pin_requests')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'PENDING_OTP')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!request) {
      return res.status(400).json({ success: false, message: 'No PIN request awaiting OTP' });
    }

    const purpose = request.request_type === 'RESET' ? 'PIN_RESET' : 'PIN_CREATE';
    await createAndSendOtp(user.id, user.email, purpose);
    return res.json({ success: true, message: 'PIN OTP resent to your email', data: { purpose } });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.getPaymentPinStatus = async (req, res) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('payment_pin_hash, payment_pin_status')
      .eq('id', req.user.id)
      .single();

    const { data: pending } = await supabase
      .from('pin_requests')
      .select('id, request_type, status, created_at, otp_verified_at, reviewed_at, review_note')
      .eq('user_id', req.user.id)
      .in('status', ['PENDING_OTP', 'PENDING_APPROVAL'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return res.json({
      success: true,
      data: {
        hasApprovedPin: Boolean(user.payment_pin_hash) && user.payment_pin_status === 'APPROVED',
        paymentPinStatus: user.payment_pin_status || 'NONE',
        pendingRequest: pending || null,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const updates = {
      full_name: req.body.fullName,
      phone: req.body.phone,
      address: req.body.address,
    };
    if (req.file) updates.profile_image = `/uploads/${req.file.filename}`;
    Object.keys(updates).forEach((k) => updates[k] === undefined && delete updates[k]);

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user.id)
      .select('*, roles(name)')
      .single();
    if (error) throw error;
    return res.json({ success: true, data: publicUser(data, data.roles.name) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
