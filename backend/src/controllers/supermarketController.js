const QRCode = require('qrcode');
const { supabase } = require('../config/supabase');
const { generateCode, signToken } = require('../utils/security');
const { writeAudit } = require('../services/auditService');

exports.listSupermarkets = async (req, res) => {
  try {
    let query = supabase
      .from('supermarkets')
      .select('*, branches(*)')
      .order('created_at', { ascending: false });

    if (req.user?.role === 'MANAGER') {
      query = query.eq('owner_id', req.user.id);
    }

    const { data, error } = await query;
    if (error) throw error;
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.createSupermarket = async (req, res) => {
  try {
    const { name, description, address, phone, email, branchName, branchAddress } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Supermarket name required' });

    // Creator becomes owner; if CUSTOMER creating shop, promote to MANAGER
    let ownerId = req.user.id;
    if (req.user.role === 'ADMIN' && req.body.ownerId) ownerId = req.body.ownerId;

    const { data: market, error } = await supabase
      .from('supermarkets')
      .insert({
        name,
        description: description || null,
        address: address || null,
        phone: phone || null,
        email: email || null,
        logo: req.file ? `/uploads/${req.file.filename}` : null,
        owner_id: ownerId,
        status: 'ACTIVE',
      })
      .select('*')
      .single();
    if (error) throw error;

    const branchCode = generateCode('BRANCH');
    const qrPayload = `SMARTSCAN_BRANCH:${branchCode}`;
    const { data: branch, error: bErr } = await supabase
      .from('branches')
      .insert({
        supermarket_id: market.id,
        name: branchName || `${name} Main Branch`,
        code: branchCode,
        address: branchAddress || address || null,
        qr_payload: qrPayload,
        status: 'ACTIVE',
      })
      .select('*')
      .single();
    if (bErr) throw bErr;

    // Link owner as manager of this supermarket
    const { data: managerRole } = await supabase.from('roles').select('id').eq('name', 'MANAGER').single();
    await supabase
      .from('users')
      .update({
        role_id: managerRole.id,
        supermarket_id: market.id,
        branch_id: branch.id,
        account_status: 'APPROVED',
      })
      .eq('id', ownerId);

    await writeAudit({
      userId: req.user.id,
      action: 'CREATE_SUPERMARKET',
      entityType: 'supermarkets',
      entityId: market.id,
      details: { name },
      ip: req.ip,
    });

    const qrDataUrl = await QRCode.toDataURL(qrPayload);
    const token = signToken({ id: ownerId, role: 'MANAGER', email: req.user.email });

    return res.status(201).json({
      success: true,
      message: 'Supermarket created. You are now the owner/manager.',
      data: {
        supermarket: market,
        branch,
        branchQr: qrDataUrl,
        qrPayload,
        token,
        user: {
          id: ownerId,
          email: req.user.email,
          fullName: req.user.fullName,
          role: 'MANAGER',
          supermarketId: market.id,
          branchId: branch.id,
          accountStatus: 'APPROVED',
        },
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.addBranch = async (req, res) => {
  try {
    const { supermarketId, name, address, phone } = req.body;
    if (!supermarketId || !name) {
      return res.status(400).json({ success: false, message: 'supermarketId and name required' });
    }

    if (req.user.role === 'MANAGER') {
      const { data: market } = await supabase.from('supermarkets').select('owner_id').eq('id', supermarketId).single();
      if (!market || market.owner_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Not your supermarket' });
      }
    }

    const branchCode = generateCode('BRANCH');
    const qrPayload = `SMARTSCAN_BRANCH:${branchCode}`;
    const { data, error } = await supabase
      .from('branches')
      .insert({
        supermarket_id: supermarketId,
        name,
        code: branchCode,
        address: address || null,
        phone: phone || null,
        qr_payload: qrPayload,
        status: 'ACTIVE',
      })
      .select('*')
      .single();
    if (error) throw error;

    const qrDataUrl = await QRCode.toDataURL(qrPayload);
    return res.status(201).json({ success: true, data: { branch: data, qrDataUrl, qrPayload } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getBranchQr = async (req, res) => {
  try {
    const { data: branch, error } = await supabase.from('branches').select('*, supermarkets(name)').eq('id', req.params.id).single();
    if (error || !branch) return res.status(404).json({ success: false, message: 'Branch not found' });
    const qrDataUrl = await QRCode.toDataURL(branch.qr_payload);
    return res.json({ success: true, data: { branch, qrDataUrl, qrPayload: branch.qr_payload } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.publicList = async (_req, res) => {
  const { data, error } = await supabase
    .from('supermarkets')
    .select('id, name, description, logo, address, status, branches(id, name, code, address, status)')
    .eq('status', 'ACTIVE');
  if (error) return res.status(500).json({ success: false, message: error.message });
  return res.json({ success: true, data });
};
