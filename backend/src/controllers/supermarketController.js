const QRCode = require('qrcode');
const { supabase } = require('../config/supabase');
const { generateCode, signToken, hashPassword } = require('../utils/security');
const { writeAudit } = require('../services/auditService');

exports.listSupermarkets = async (req, res) => {
  try {
    if (req.user?.role === 'MANAGER') {
      const { data: owned, error } = await supabase
        .from('supermarkets')
        .select('*, branches(*)')
        .or(`owner_id.eq.${req.user.id},id.eq.${req.user.supermarketId || '00000000-0000-0000-0000-000000000000'}`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const unique = [];
      const seen = new Set();
      for (const row of owned || []) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        unique.push({
          ...row,
          isActiveContext: row.id === req.user.supermarketId,
        });
      }
      return res.json({ success: true, data: unique });
    }

    let { data, error } = await supabase
      .from('supermarkets')
      .select('*, branches(*), manager:users!owner_id(id, full_name, email, phone)')
      .order('created_at', { ascending: false });

    if (error) {
      // Fallback if relationship alias is unavailable
      const fallback = await supabase
        .from('supermarkets')
        .select('*, branches(*)')
        .order('created_at', { ascending: false });
      if (fallback.error) throw fallback.error;
      const rows = fallback.data || [];
      const ownerIds = [...new Set(rows.map((r) => r.owner_id).filter(Boolean))];
      let managersById = {};
      if (ownerIds.length) {
        const { data: owners } = await supabase
          .from('users')
          .select('id, full_name, email, phone')
          .in('id', ownerIds);
        managersById = Object.fromEntries((owners || []).map((u) => [u.id, u]));
      }
      data = rows.map((r) => ({ ...r, manager: managersById[r.owner_id] || null }));
      error = null;
    }

    if (error) throw error;
    return res.json({ success: true, data: data || [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.createSupermarket = async (req, res) => {
  try {
    const {
      name,
      description,
      address,
      phone,
      email,
      branchName,
      branchAddress,
      managerFullName,
      managerEmail,
      managerPassword,
      managerPhone,
      ownerId: bodyOwnerId,
    } = req.body;

    if (!name) return res.status(400).json({ success: false, message: 'Supermarket name required' });

    const { data: managerRole, error: roleErr } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'MANAGER')
      .single();
    if (roleErr || !managerRole) {
      return res.status(500).json({ success: false, message: 'MANAGER role missing' });
    }

    let ownerId = req.user.id;
    let managerAccount = null;
    let issuedToken = null;
    const isAdmin = req.user.role === 'ADMIN';

    if (isAdmin) {
      const emailNorm = String(managerEmail || '').trim().toLowerCase();
      const password = String(managerPassword || '');
      const fullName = String(managerFullName || '').trim();

      if (bodyOwnerId) {
        ownerId = bodyOwnerId;
      } else if (emailNorm && password) {
        if (!fullName) {
          return res.status(400).json({ success: false, message: 'Manager full name is required' });
        }
        if (password.length < 6) {
          return res.status(400).json({
            success: false,
            message: 'Manager password must be at least 6 characters',
          });
        }

        const { data: existing } = await supabase
          .from('users')
          .select('id, email')
          .eq('email', emailNorm)
          .maybeSingle();

        if (existing) {
          return res.status(409).json({
            success: false,
            message: 'That email is already registered. Use a new email for this supermarket manager.',
          });
        }

        const passwordHash = await hashPassword(password);
        const { data: createdUser, error: userErr } = await supabase
          .from('users')
          .insert({
            full_name: fullName,
            email: emailNorm,
            phone: managerPhone || phone || null,
            password_hash: passwordHash,
            role_id: managerRole.id,
            email_verified: true,
            account_status: 'APPROVED',
            is_active: true,
          })
          .select('id, full_name, email, phone')
          .single();
        if (userErr) throw userErr;

        ownerId = createdUser.id;
        managerAccount = {
          id: createdUser.id,
          fullName: createdUser.full_name,
          email: createdUser.email,
          phone: createdUser.phone,
          role: 'MANAGER',
        };
      } else {
        return res.status(400).json({
          success: false,
          message:
            'Provide manager full name, email, and password so they can log in to manage this supermarket.',
        });
      }
    }

    const { data: market, error } = await supabase
      .from('supermarkets')
      .insert({
        name,
        description: description || null,
        address: address || null,
        phone: phone || null,
        email: email || managerEmail || null,
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

    // Link manager account to this supermarket (never demote ADMIN)
    await supabase
      .from('users')
      .update({
        role_id: managerRole.id,
        supermarket_id: market.id,
        branch_id: branch.id,
        account_status: 'APPROVED',
        is_active: true,
        email_verified: true,
      })
      .eq('id', ownerId);

    await writeAudit({
      userId: req.user.id,
      action: 'CREATE_SUPERMARKET',
      entityType: 'supermarkets',
      entityId: market.id,
      details: { name, managerEmail: managerAccount?.email || null, adminProvisioned: isAdmin },
      ip: req.ip,
    });

    const qrDataUrl = await QRCode.toDataURL(qrPayload);

    if (!isAdmin) {
      issuedToken = signToken({ id: ownerId, role: 'MANAGER', email: req.user.email });
      managerAccount = {
        id: ownerId,
        fullName: req.user.fullName,
        email: req.user.email,
        role: 'MANAGER',
      };
    } else if (!managerAccount) {
      const { data: ownerRow } = await supabase
        .from('users')
        .select('id, full_name, email, phone')
        .eq('id', ownerId)
        .single();
      if (ownerRow) {
        managerAccount = {
          id: ownerRow.id,
          fullName: ownerRow.full_name,
          email: ownerRow.email,
          phone: ownerRow.phone,
          role: 'MANAGER',
        };
      }
    }

    return res.status(201).json({
      success: true,
      message: isAdmin
        ? `Supermarket created. Manager can log in with ${managerAccount?.email || 'their email'}.`
        : 'Supermarket created. You are now the owner/manager.',
      data: {
        supermarket: market,
        branch,
        branchQr: qrDataUrl,
        qrPayload,
        manager: managerAccount,
        ...(issuedToken
          ? {
              token: issuedToken,
              user: {
                id: ownerId,
                email: req.user.email,
                fullName: req.user.fullName,
                role: 'MANAGER',
                supermarketId: market.id,
                branchId: branch.id,
                accountStatus: 'APPROVED',
              },
            }
          : {}),
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
    const { data: branch, error } = await supabase
      .from('branches')
      .select('*, supermarkets(name)')
      .eq('id', req.params.id)
      .single();
    if (error || !branch) return res.status(404).json({ success: false, message: 'Branch not found' });
    const qrDataUrl = await QRCode.toDataURL(branch.qr_payload);
    return res.json({ success: true, data: { branch, qrDataUrl, qrPayload: branch.qr_payload } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/** Switch manager's active supermarket context (products, customers, sessions) */
exports.switchActiveSupermarket = async (req, res) => {
  try {
    const supermarketId = req.params.id;
    const { data: market, error } = await supabase
      .from('supermarkets')
      .select('id, name, owner_id, branches(id, name)')
      .eq('id', supermarketId)
      .single();
    if (error || !market) return res.status(404).json({ success: false, message: 'Supermarket not found' });

    const isOwner = market.owner_id === req.user.id;
    const isAssigned = req.user.supermarketId === supermarketId;
    if (req.user.role !== 'ADMIN' && !isOwner && !isAssigned) {
      return res.status(403).json({ success: false, message: 'Not allowed to manage this supermarket' });
    }

    const branchId = market.branches?.[0]?.id || null;
    await supabase
      .from('users')
      .update({ supermarket_id: market.id, branch_id: branchId })
      .eq('id', req.user.id);

    return res.json({
      success: true,
      message: `Now managing ${market.name}`,
      data: { supermarketId: market.id, branchId, name: market.name },
    });
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
