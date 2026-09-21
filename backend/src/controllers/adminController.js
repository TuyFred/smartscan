const { supabase } = require('../config/supabase');
const { writeAudit } = require('../services/auditService');
const { hashPassword, generateCode } = require('../utils/security');

exports.listUsers = async (req, res) => {
  try {
    let query = supabase
      .from('users')
      .select('id, full_name, email, phone, address, national_id, profile_image, account_status, email_verified, is_active, supermarket_id, branch_id, created_at, roles(name)')
      .order('created_at', { ascending: false });

    if (req.query.role) {
      const { data: role } = await supabase.from('roles').select('id').eq('name', req.query.role).single();
      if (role) query = query.eq('role_id', role.id);
    }
    if (req.query.status) query = query.eq('account_status', req.query.status);

    const { data, error } = await query.limit(200);
    if (error) throw error;
    return res.json({
      success: true,
      data: (data || []).map((u) => ({ ...u, role: u.roles?.name })),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.approveUser = async (req, res) => {
  try {
    const { status = 'APPROVED' } = req.body;
    if (!['APPROVED', 'REJECTED', 'SUSPENDED', 'ACTIVE'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const nextStatus = status === 'APPROVED' ? 'APPROVED' : status;
    const { data, error } = await supabase
      .from('users')
      .update({
        account_status: nextStatus,
        is_active: status !== 'SUSPENDED' && status !== 'REJECTED',
      })
      .eq('id', req.params.id)
      .select('id, full_name, email, account_status, supermarket_id')
      .single();
    if (error) throw error;

    if (data.supermarket_id && (nextStatus === 'APPROVED' || nextStatus === 'ACTIVE')) {
      await supabase.from('supermarkets').update({ status: 'ACTIVE' }).eq('id', data.supermarket_id);
      await supabase.from('branches').update({ status: 'ACTIVE' }).eq('supermarket_id', data.supermarket_id);
    }
    if (data.supermarket_id && (nextStatus === 'REJECTED' || nextStatus === 'SUSPENDED')) {
      await supabase.from('supermarkets').update({ status: nextStatus }).eq('id', data.supermarket_id);
    }

    await writeAudit({
      userId: req.user.id,
      action: 'USER_STATUS_UPDATE',
      entityType: 'users',
      entityId: data.id,
      details: { status },
      ip: req.ip,
    });

    return res.json({ success: true, message: `User marked ${status}`, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.createStaff = async (req, res) => {
  try {
    const { fullName, email, phone, password, role, supermarketId, branchId } = req.body;
    if (!['MANAGER', 'CASHIER', 'ADMIN'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid staff role' });
    }
    const { data: roleRow } = await supabase.from('roles').select('id').eq('name', role).single();
    const passwordHash = await hashPassword(password || 'Password123!');

    const { data, error } = await supabase
      .from('users')
      .insert({
        full_name: fullName,
        email: email.toLowerCase(),
        phone: phone || null,
        password_hash: passwordHash,
        role_id: roleRow.id,
        email_verified: true,
        account_status: 'APPROVED',
        is_active: true,
        supermarket_id: supermarketId || null,
        branch_id: branchId || null,
      })
      .select('id, full_name, email, account_status')
      .single();
    if (error) throw error;
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { fullName, email, phone, role, supermarketId, branchId, accountStatus, isActive } = req.body;
    const payload = {};

    if (fullName) payload.full_name = fullName;
    if (email) payload.email = String(email).toLowerCase();
    if (phone !== undefined) payload.phone = phone || null;
    if (role) {
      const { data: roleRow } = await supabase.from('roles').select('id').eq('name', role).single();
      if (roleRow) payload.role_id = roleRow.id;
    }
    if (supermarketId !== undefined) payload.supermarket_id = supermarketId || null;
    if (branchId !== undefined) payload.branch_id = branchId || null;
    if (accountStatus) payload.account_status = accountStatus;
    if (isActive !== undefined) payload.is_active = Boolean(isActive);

    const { data, error } = await supabase
      .from('users')
      .update(payload)
      .eq('id', req.params.id)
      .select('id, full_name, email, phone, account_status, is_active, supermarket_id, branch_id, roles(name)')
      .single();

    if (error) throw error;
    return res.json({ success: true, data: { ...data, role: data.roles?.name } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ is_active: false, account_status: 'REJECTED' })
      .eq('id', req.params.id)
      .select('id, full_name, email')
      .single();

    if (error) throw error;
    return res.json({ success: true, message: 'User deactivated', data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.dashboardStats = async (req, res) => {
  try {
    const role = req.user.role;
    const stats = {};

    if (role === 'ADMIN') {
      const tables = ['users', 'supermarkets', 'products', 'shopping_sessions', 'payments', 'receipts'];
      for (const t of tables) {
        const { count } = await supabase.from(t).select('*', { count: 'exact', head: true });
        stats[t] = count || 0;
      }
      const { count: pending } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('account_status', 'PENDING_APPROVAL');
      stats.pendingApprovals = pending || 0;
      const { count: pendingPins } = await supabase
        .from('pin_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'PENDING_APPROVAL');
      stats.pendingPinApprovals = pendingPins || 0;
    }

    if (role === 'MANAGER' || role === 'CASHIER') {
      const sid = req.user.supermarketId;
      const { count: activeSessions } = await supabase
        .from('shopping_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('supermarket_id', sid)
        .eq('status', 'ACTIVE');
      const { count: products } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('supermarket_id', sid);
      const { data: payments } = await supabase
        .from('payments')
        .select('amount, session_id, shopping_sessions!inner(supermarket_id)')
        .eq('shopping_sessions.supermarket_id', sid);
      stats.activeSessions = activeSessions || 0;
      stats.products = products || 0;
      stats.salesTotal = (payments || []).reduce((s, p) => s + Number(p.amount), 0);
      stats.paymentsCount = (payments || []).length;
      const { data: storeSessions } = await supabase
        .from('shopping_sessions')
        .select('customer_id')
        .eq('supermarket_id', sid);
      stats.customers = new Set((storeSessions || []).map((s) => s.customer_id)).size;
    }

    if (role === 'CUSTOMER') {
      const { data: card } = await supabase
        .from('customer_cards')
        .select('*')
        .eq('customer_id', req.user.id)
        .maybeSingle();
      const { data: session } = await supabase
        .from('shopping_sessions')
        .select('*, cart_items(*)')
        .eq('customer_id', req.user.id)
        .eq('status', 'ACTIVE')
        .maybeSingle();
      const { count: history } = await supabase
        .from('shopping_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', req.user.id);
      stats.card = card;
      stats.activeSession = session;
      stats.historyCount = history || 0;
    }

    return res.json({ success: true, data: stats });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.listDevices = async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('iot_devices')
      .select('*')
      .order('last_seen_at', { ascending: false, nullsFirst: false })
      .limit(50);
    if (error) throw error;
    const now = Date.now();
    const rows = (data || []).map((device) => {
      const seenAt = device.last_seen_at ? new Date(device.last_seen_at).getTime() : null;
      const connected = Boolean(seenAt && now - seenAt < 5 * 60 * 1000 && device.status === 'ACTIVE');
      return { ...device, connected };
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.registerDevice = async (req, res) => {
  try {
    const { name, type, supermarketId, branchId } = req.body;
    const deviceCode = generateCode('IOT');
    const apiKey = require('../utils/security').generateToken(20);
    const { data, error } = await supabase
      .from('iot_devices')
      .insert({
        device_code: deviceCode,
        name: name || deviceCode,
        type: type || 'EXIT_SCANNER',
        supermarket_id: supermarketId || null,
        branch_id: branchId || null,
        api_key: apiKey,
        status: 'ACTIVE',
      })
      .select('*')
      .single();
    if (error) throw error;
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.listPayments = async (req, res) => {
  let query = supabase
    .from('payments')
    .select('*, users!payments_customer_id_fkey(full_name, email), shopping_sessions(session_code, supermarket_id)')
    .order('paid_at', { ascending: false })
    .limit(100);
  if (req.user.role === 'CUSTOMER') query = query.eq('customer_id', req.user.id);
  const { data, error } = await query;
  if (error) return res.status(500).json({ success: false, message: error.message });
  let rows = data || [];
  if (req.user.role === 'MANAGER') {
    rows = rows.filter((p) => p.shopping_sessions?.supermarket_id === req.user.supermarketId);
  }
  return res.json({ success: true, data: rows });
};

exports.auditLogs = async (_req, res) => {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return res.status(500).json({ success: false, message: error.message });
  return res.json({ success: true, data });
};

exports.listPinRequests = async (req, res) => {
  try {
    let query = supabase
      .from('pin_requests')
      .select(
        'id, request_type, status, created_at, otp_verified_at, reviewed_at, review_note, users!pin_requests_user_id_fkey(id, full_name, email, phone, payment_pin_status)'
      )
      .order('created_at', { ascending: false })
      .limit(100);

    if (req.query.status) query = query.eq('status', req.query.status);
    else query = query.in('status', ['PENDING_APPROVAL', 'PENDING_OTP']);

    const { data, error } = await query;
    if (error) throw error;
    return res.json({ success: true, data: data || [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.reviewPinRequest = async (req, res) => {
  try {
    const { decision, note } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'decision must be APPROVED or REJECTED' });
    }

    const { data: request, error } = await supabase
      .from('pin_requests')
      .select('*, users!pin_requests_user_id_fkey(id, full_name, email)')
      .eq('id', req.params.id)
      .single();
    if (error || !request) {
      return res.status(404).json({ success: false, message: 'PIN request not found' });
    }
    if (request.status !== 'PENDING_APPROVAL') {
      return res.status(400).json({
        success: false,
        message: `Request status is ${request.status}. Only PENDING_APPROVAL can be reviewed.`,
      });
    }

    if (decision === 'APPROVED') {
      await supabase
        .from('users')
        .update({
          payment_pin_hash: request.pin_hash,
          payment_pin_status: 'APPROVED',
        })
        .eq('id', request.user_id);
    } else {
      // Keep existing approved PIN if reset was rejected; otherwise mark rejected
      const { data: user } = await supabase
        .from('users')
        .select('payment_pin_hash, payment_pin_status')
        .eq('id', request.user_id)
        .single();

      const nextStatus =
        user?.payment_pin_hash && user.payment_pin_status === 'APPROVED' ? 'APPROVED' : 'REJECTED';

      await supabase
        .from('users')
        .update({ payment_pin_status: nextStatus })
        .eq('id', request.user_id);
    }

    await supabase
      .from('pin_requests')
      .update({
        status: decision,
        reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString(),
        review_note: note || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', request.id);

    const { sendPinStatusEmail } = require('../services/emailService');
    await sendPinStatusEmail(
      request.users.email,
      request.users.full_name,
      decision,
      request.request_type
    );

    await writeAudit({
      userId: req.user.id,
      action: `PIN_REQUEST_${decision}`,
      entityType: 'pin_requests',
      entityId: request.id,
      details: { customerId: request.user_id, decision },
      ip: req.ip,
    });

    return res.json({
      success: true,
      message: `Payment PIN request ${decision.toLowerCase()}`,
      data: { id: request.id, status: decision },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
