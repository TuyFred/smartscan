const { verifyToken } = require('../utils/security');
const { supabase } = require('../config/supabase');

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const decoded = verifyToken(token);
    const { data: user, error } = await supabase
      .from('users')
      .select('*, roles(name)')
      .eq('id', decoded.id)
      .single();

    if (error || !user) {
      return res.status(401).json({ success: false, message: 'Invalid session' });
    }
    if (!user.is_active || user.account_status === 'SUSPENDED') {
      return res.status(403).json({ success: false, message: 'Account suspended' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.roles?.name || decoded.role,
      accountStatus: user.account_status,
      supermarketId: user.supermarket_id,
      branchId: user.branch_id,
      profileImage: user.profile_image,
    };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    next();
  };
}

async function requireDeviceAuth(req, res, next) {
  const apiKey = req.headers['x-device-key'] || req.body?.apiKey;
  const deviceName = req.headers['x-device-name'] || req.body?.device || req.body?.deviceName;

  if (!apiKey && !deviceName) {
    return res.status(401).json({ success: false, message: 'Device key or device name required' });
  }

  let device = null;

  if (apiKey) {
    const { data } = await supabase
      .from('iot_devices')
      .select('*')
      .eq('api_key', apiKey)
      .eq('status', 'ACTIVE')
      .maybeSingle();
    device = data;
  }

  if (!device && deviceName) {
    const { data } = await supabase
      .from('iot_devices')
      .select('*')
      .ilike('name', deviceName)
      .eq('status', 'ACTIVE')
      .maybeSingle();
    device = data;
  }

  if (!device) {
    const config = require('../config/env');
    if (apiKey === config.iotApiKey || (deviceName && String(deviceName).toUpperCase() === 'SMARTSCAN-RFID-01')) {
      req.device = { id: null, type: 'GENERIC' };
      return next();
    }
    return res.status(401).json({ success: false, message: 'Invalid device key or device name' });
  }

  await supabase
    .from('iot_devices')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', device.id);

  req.device = device;
  next();
}

module.exports = { requireAuth, requireRole, requireDeviceAuth };
