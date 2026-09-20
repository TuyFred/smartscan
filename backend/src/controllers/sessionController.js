const { supabase } = require('../config/supabase');
const { generateCode, money } = require('../utils/security');

async function recalculateSession(sessionId) {
  const { data: items } = await supabase.from('cart_items').select('*').eq('session_id', sessionId);
  const total = money((items || []).reduce((sum, i) => sum + Number(i.subtotal), 0));
  await supabase
    .from('shopping_sessions')
    .update({ subtotal: total, total_amount: total, updated_at: new Date().toISOString() })
    .eq('id', sessionId);
  return { items: items || [], total };
}

async function getSessionFull(sessionId) {
  const { data: session, error } = await supabase
    .from('shopping_sessions')
    .select(
      `*,
      users!shopping_sessions_customer_id_fkey(id, full_name, email, phone, profile_image),
      supermarkets(id, name, logo),
      branches(id, name, code, address),
      cart_items(*, products(image, unit, weight))`
    )
    .eq('id', sessionId)
    .single();
  if (error) throw error;
  return session;
}

exports.startSession = async (req, res) => {
  try {
    const { qrPayload } = req.body;
    if (!qrPayload || !String(qrPayload).startsWith('SMARTSCAN_BRANCH:')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid supermarket QR. Scan the branch entrance QR to start shopping.',
      });
    }

    // One active session at a time
    const { data: existing } = await supabase
      .from('shopping_sessions')
      .select('id, session_code')
      .eq('customer_id', req.user.id)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'You already have an active shopping session',
        data: existing,
      });
    }

    const { data: branch, error } = await supabase
      .from('branches')
      .select('*, supermarkets(*)')
      .eq('qr_payload', qrPayload.trim())
      .maybeSingle();

    if (error || !branch) {
      return res.status(404).json({ success: false, message: 'Branch QR not recognized' });
    }
    if (branch.status !== 'ACTIVE' || branch.supermarkets?.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'Supermarket or branch is inactive' });
    }

    const sessionCode = generateCode('SS');
    const { data: session, error: sErr } = await supabase
      .from('shopping_sessions')
      .insert({
        session_code: sessionCode,
        customer_id: req.user.id,
        supermarket_id: branch.supermarket_id,
        branch_id: branch.id,
        status: 'ACTIVE',
        payment_status: 'UNPAID',
        subtotal: 0,
        total_amount: 0,
      })
      .select('*')
      .single();
    if (sErr) throw sErr;

    const full = await getSessionFull(session.id);
    const io = req.app.get('io');
    if (io) {
      io.to(`supermarket:${branch.supermarket_id}`).emit('session:started', full);
    }

    return res.status(201).json({
      success: true,
      message: `Shopping session started successfully. Session ID: ${sessionCode}`,
      data: full,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.scanProduct = async (req, res) => {
  try {
    const sessionId = req.params.id;
    const { qrPayload } = req.body;

    const { data: session } = await supabase.from('shopping_sessions').select('*').eq('id', sessionId).single();
    if (!session || session.customer_id !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    if (session.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'Session is not active' });
    }
    if (!qrPayload || !String(qrPayload).startsWith('SMARTSCAN_PRODUCT:')) {
      return res.status(400).json({ success: false, message: 'Invalid product QR code' });
    }

    const { data: product } = await supabase
      .from('products')
      .select('*')
      .eq('qr_payload', qrPayload.trim())
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    if (product.supermarket_id !== session.supermarket_id) {
      return res.status(400).json({ success: false, message: 'Product does not belong to this supermarket' });
    }
    if (product.quantity_available <= 0) {
      return res.status(400).json({ success: false, message: 'Product out of stock' });
    }

    const { data: existingItem } = await supabase
      .from('cart_items')
      .select('*')
      .eq('session_id', sessionId)
      .eq('product_id', product.id)
      .maybeSingle();

    if (existingItem) {
      const qty = existingItem.quantity + 1;
      await supabase
        .from('cart_items')
        .update({
          quantity: qty,
          unit_price: money(product.price),
          subtotal: money(product.price * qty),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingItem.id);
    } else {
      await supabase.from('cart_items').insert({
        session_id: sessionId,
        product_id: product.id,
        product_name: product.name,
        unit_price: money(product.price),
        weight: product.weight,
        unit: product.unit,
        quantity: 1,
        subtotal: money(product.price),
      });
    }

    const { total, items } = await recalculateSession(sessionId);
    const full = await getSessionFull(sessionId);

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${req.user.id}`).emit('session:updated', full);
      io.to(`supermarket:${session.supermarket_id}`).emit('session:updated', full);
    }

    return res.json({
      success: true,
      message: `${product.name} added to cart`,
      data: { session: full, items, total },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSession = async (req, res) => {
  try {
    const full = await getSessionFull(req.params.id);
    if (
      req.user.role === 'CUSTOMER' &&
      full.customer_id !== req.user.id
    ) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    if (
      (req.user.role === 'MANAGER' || req.user.role === 'CASHIER') &&
      full.supermarket_id !== req.user.supermarketId
    ) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    return res.json({ success: true, data: full });
  } catch (err) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }
};

exports.getActiveSession = async (req, res) => {
  const { data } = await supabase
    .from('shopping_sessions')
    .select('id')
    .eq('customer_id', req.user.id)
    .eq('status', 'ACTIVE')
    .maybeSingle();
  if (!data) return res.json({ success: true, data: null });
  const full = await getSessionFull(data.id);
  return res.json({ success: true, data: full });
};

exports.updateCartItem = async (req, res) => {
  try {
    const { quantity } = req.body;
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      return res.status(400).json({ success: false, message: 'Quantity must be a positive integer' });
    }

    const { data: item } = await supabase.from('cart_items').select('*, shopping_sessions(*)').eq('id', req.params.id).single();
    if (!item || item.shopping_sessions.customer_id !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Cart item not found' });
    }
    if (item.shopping_sessions.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'Session not active' });
    }

    await supabase
      .from('cart_items')
      .update({
        quantity: qty,
        subtotal: money(item.unit_price * qty),
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id);

    await recalculateSession(item.session_id);
    const full = await getSessionFull(item.session_id);
    return res.json({ success: true, data: full });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.removeCartItem = async (req, res) => {
  try {
    const { data: item } = await supabase.from('cart_items').select('*, shopping_sessions(*)').eq('id', req.params.id).single();
    if (!item || item.shopping_sessions.customer_id !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Cart item not found' });
    }
    await supabase.from('cart_items').delete().eq('id', item.id);
    await recalculateSession(item.session_id);
    const full = await getSessionFull(item.session_id);
    return res.json({ success: true, data: full });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.listSessions = async (req, res) => {
  try {
    let query = supabase
      .from('shopping_sessions')
      .select(
        `*,
        users!shopping_sessions_customer_id_fkey(id, full_name, email, phone, profile_image),
        branches(name),
        cart_items(id)`
      )
      .order('started_at', { ascending: false });

    if (req.query.status) query = query.eq('status', req.query.status);
    if (req.user.role === 'MANAGER' || req.user.role === 'CASHIER') {
      query = query.eq('supermarket_id', req.user.supermarketId);
    }
    if (req.user.role === 'CUSTOMER') {
      query = query.eq('customer_id', req.user.id);
    }

    const { data, error } = await query.limit(100);
    if (error) throw error;
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.cancelSession = async (req, res) => {
  const { data: session } = await supabase.from('shopping_sessions').select('*').eq('id', req.params.id).single();
  if (!session || session.customer_id !== req.user.id) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }
  if (session.status !== 'ACTIVE') {
    return res.status(400).json({ success: false, message: 'Only active sessions can be cancelled' });
  }
  await supabase
    .from('shopping_sessions')
    .update({ status: 'CANCELLED', completed_at: new Date().toISOString() })
    .eq('id', session.id);
  return res.json({ success: true, message: 'Session cancelled' });
};

module.exports.recalculateSession = recalculateSession;
module.exports.getSessionFull = getSessionFull;
