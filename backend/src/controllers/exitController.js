const { supabase } = require('../config/supabase');

exports.verifyExit = async (req, res) => {
  try {
    const { qrPayload } = req.body;
    if (!qrPayload) {
      return res.status(400).json({ success: false, valid: false, message: 'qrPayload required' });
    }

    const { data: receipt } = await supabase
      .from('receipts')
      .select('*, payments(status), orders(status)')
      .eq('qr_payload', qrPayload.trim())
      .maybeSingle();

    const fail = async (reason) => {
      await supabase.from('exit_verifications').insert({
        receipt_id: receipt?.id || null,
        device_id: req.device?.id || null,
        status: 'FAILED',
        reason,
        scanned_payload: qrPayload,
      });
      return res.status(400).json({
        success: false,
        valid: false,
        action: 'DENY',
        leds: { green: false, red: true },
        buzzer: 'WARNING',
        servo: 'CLOSED',
        message: reason,
      });
    };

    if (!receipt) return fail('Receipt does not exist');
    if (receipt.status === 'CANCELLED') return fail('Receipt has been cancelled');
    if (receipt.status === 'VERIFIED') return fail('Receipt already used');
    if (receipt.payments?.status !== 'COMPLETED' && receipt.orders?.status !== 'PAID') {
      return fail('Order is unpaid');
    }

    await supabase
      .from('receipts')
      .update({ status: 'VERIFIED', verified_at: new Date().toISOString() })
      .eq('id', receipt.id);

    await supabase
      .from('shopping_sessions')
      .update({ status: 'COMPLETED' })
      .eq('id', receipt.session_id);

    await supabase.from('exit_verifications').insert({
      receipt_id: receipt.id,
      device_id: req.device?.id || null,
      status: 'SUCCESS',
      reason: 'Valid paid receipt',
      scanned_payload: qrPayload,
    });

    return res.json({
      success: true,
      valid: true,
      action: 'ALLOW',
      leds: { green: true, red: false },
      buzzer: 'SUCCESS',
      servo: 'OPEN',
      message: 'VALID — Gate opening',
      data: {
        receiptNumber: receipt.receipt_number,
        totalAmount: receipt.total_amount,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, valid: false, message: err.message });
  }
};

exports.listVerifications = async (req, res) => {
  let query = supabase
    .from('exit_verifications')
    .select('*, receipts(receipt_number, total_amount, customer_id)')
    .order('verified_at', { ascending: false })
    .limit(100);
  const { data, error } = await query;
  if (error) return res.status(500).json({ success: false, message: error.message });
  return res.json({ success: true, data });
};

exports.getReceipt = async (req, res) => {
  const { data, error } = await supabase
    .from('receipts')
    .select(
      `*,
      users!receipts_customer_id_fkey(full_name, email),
      supermarkets(name),
      branches(name),
      payments(*),
      orders(*, order_items(*))`
    )
    .eq('id', req.params.id)
    .single();
  if (error || !data) return res.status(404).json({ success: false, message: 'Receipt not found' });

  if (req.user.role === 'CUSTOMER' && data.customer_id !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  const QRCode = require('qrcode');
  const qrDataUrl = await QRCode.toDataURL(data.qr_payload);
  return res.json({ success: true, data: { ...data, qrDataUrl } });
};

exports.listReceipts = async (req, res) => {
  let query = supabase
    .from('receipts')
    .select('*, supermarkets(name), branches(name)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (req.user.role === 'CUSTOMER') query = query.eq('customer_id', req.user.id);
  if (req.user.role === 'MANAGER') query = query.eq('supermarket_id', req.user.supermarketId);
  const { data, error } = await query;
  if (error) return res.status(500).json({ success: false, message: error.message });
  return res.json({ success: true, data });
};
