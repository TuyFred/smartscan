const QRCode = require('qrcode');
const { supabase } = require('../config/supabase');
const { generateCode, money } = require('../utils/security');

async function ensureMarketAccess(user, supermarketId) {
  if (user.role === 'ADMIN') return true;
  if (!supermarketId) return false;
  if (user.role === 'CASHIER') {
    return user.supermarketId === supermarketId;
  }
  if (user.role === 'MANAGER') {
    if (user.supermarketId === supermarketId) return true;
    const { data } = await supabase
      .from('supermarkets')
      .select('id')
      .eq('id', supermarketId)
      .eq('owner_id', user.id)
      .maybeSingle();
    return Boolean(data);
  }
  return false;
}

async function loadProductForStaff(req, productId) {
  const { data: product, error } = await supabase.from('products').select('*').eq('id', productId).single();
  if (error || !product) return { error: { status: 404, message: 'Product not found' } };
  if (!(await ensureMarketAccess(req.user, product.supermarket_id))) {
    return { error: { status: 403, message: 'Not allowed to manage this product' } };
  }
  return { product };
}

exports.listProducts = async (req, res) => {
  try {
    let query = supabase.from('products').select('*, supermarkets(name), branches(name)').order('created_at', { ascending: false });

    if (req.query.supermarketId) query = query.eq('supermarket_id', req.query.supermarketId);
    if (req.query.branchId) query = query.eq('branch_id', req.query.branchId);
    if (req.user?.role === 'MANAGER' || req.user?.role === 'CASHIER') {
      query = query.eq('supermarket_id', req.user.supermarketId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      sku,
      category,
      description,
      price,
      weight,
      unit,
      quantityAvailable,
      supermarketId,
      branchId,
    } = req.body;

    const marketId = supermarketId || req.user.supermarketId;
    if (req.user.role === 'ADMIN' && !supermarketId) {
      return res.status(400).json({
        success: false,
        message: 'Select which supermarket this product belongs to',
      });
    }
    if (!name || price === undefined || !marketId) {
      return res.status(400).json({ success: false, message: 'name, price, supermarketId required' });
    }
    if (weight === undefined || weight === null || weight === '') {
      return res.status(400).json({ success: false, message: 'Product weight is required' });
    }
    if (!(await ensureMarketAccess(req.user, marketId)) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const productCode = generateCode('PROD');
    const qrPayload = `SMARTSCAN_PRODUCT:${productCode}`;

    const { data, error } = await supabase
      .from('products')
      .insert({
        supermarket_id: marketId,
        branch_id: branchId || req.user.branchId || null,
        name,
        sku: sku || productCode,
        category: category || 'General',
        description: description || null,
        image: req.file ? `/uploads/${req.file.filename}` : null,
        price: money(price),
        weight: Number(weight || 0),
        unit: unit || 'pcs',
        quantity_available: Number(quantityAvailable || 0),
        product_code: productCode,
        qr_payload: qrPayload,
        status: 'ACTIVE',
      })
      .select('*')
      .single();
    if (error) throw error;

    const qrDataUrl = await QRCode.toDataURL(qrPayload);
    return res.status(201).json({ success: true, data: { product: data, qrDataUrl, qrPayload } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const loaded = await loadProductForStaff(req, req.params.id);
    if (loaded.error) return res.status(loaded.error.status).json({ success: false, message: loaded.error.message });

    const updates = {};
    const map = {
      name: 'name',
      sku: 'sku',
      category: 'category',
      description: 'description',
      price: 'price',
      weight: 'weight',
      unit: 'unit',
      quantityAvailable: 'quantity_available',
      status: 'status',
      branchId: 'branch_id',
    };
    Object.entries(map).forEach(([bodyKey, dbKey]) => {
      if (req.body[bodyKey] !== undefined) {
        updates[dbKey] = bodyKey === 'price' ? money(req.body[bodyKey]) : req.body[bodyKey];
      }
    });
    if (req.file) updates.image = `/uploads/${req.file.filename}`;
    if (!Object.keys(updates).length) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (error) throw error;
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const loaded = await loadProductForStaff(req, req.params.id);
    if (loaded.error) return res.status(loaded.error.status).json({ success: false, message: loaded.error.message });
    const { error } = await supabase.from('products').update({ status: 'INACTIVE' }).eq('id', req.params.id);
    if (error) return res.status(500).json({ success: false, message: error.message });
    return res.json({ success: true, message: 'Product deactivated' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getProductQr = async (req, res) => {
  try {
    const loaded = await loadProductForStaff(req, req.params.id);
    if (loaded.error) return res.status(loaded.error.status).json({ success: false, message: loaded.error.message });
    const product = loaded.product;
    const qrDataUrl = await QRCode.toDataURL(product.qr_payload);
    return res.json({ success: true, data: { product, qrDataUrl, qrPayload: product.qr_payload } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
