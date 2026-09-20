const { supabase } = require('../config/supabase');
const { money, generateCode, comparePassword, hashPassword } = require('../utils/security');
const { writeAudit } = require('../services/auditService');
const { getSessionFull, recalculateSession } = require('./sessionController');

exports.getMyCard = async (req, res) => {
  const { data: card } = await supabase
    .from('customer_cards')
    .select('*')
    .eq('customer_id', req.user.id)
    .maybeSingle();
  if (!card) return res.status(404).json({ success: false, message: 'No RFID card assigned' });

  const { data: transactions } = await supabase
    .from('card_transactions')
    .select('*')
    .eq('card_id', card.id)
    .order('created_at', { ascending: false })
    .limit(50);

  return res.json({ success: true, data: { card, transactions: transactions || [] } });
};

async function customerIdsForSupermarket(supermarketId) {
  if (!supermarketId) return [];
  const { data } = await supabase
    .from('shopping_sessions')
    .select('customer_id')
    .eq('supermarket_id', supermarketId);
  return [...new Set((data || []).map((row) => row.customer_id).filter(Boolean))];
}

async function applyDeposit({ card, amount, performedBy, notes, req }) {
  const depositAmount = money(amount);
  const before = money(card.balance);
  const after = money(before + depositAmount);

  const { data: updated, error } = await supabase
    .from('customer_cards')
    .update({ balance: after, status: 'ACTIVE', updated_at: new Date().toISOString() })
    .eq('id', card.id)
    .select('*')
    .single();
  if (error) throw error;

  await supabase.from('card_transactions').insert({
    card_id: card.id,
    customer_id: card.customer_id,
    type: 'DEPOSIT',
    amount: depositAmount,
    balance_before: before,
    balance_after: after,
    reference: generateCode('DEP'),
    performed_by: performedBy,
    notes: notes || 'Cashier deposit',
  });

  await writeAudit({
    userId: performedBy,
    action: 'CARD_DEPOSIT',
    entityType: 'customer_cards',
    entityId: card.id,
    details: { amount: depositAmount, before, after },
    ip: req?.ip,
  });

  const io = req?.app?.get('io');
  if (io) io.to(`user:${card.customer_id}`).emit('card:updated', updated);

  return { updated, previousBalance: before, deposit: depositAmount, newBalance: after };
}

exports.registerCard = async (req, res) => {
  try {
    const { customerId, cardUid, initialBalance = 0 } = req.body;
    if (!customerId || !cardUid) {
      return res.status(400).json({ success: false, message: 'customerId and cardUid required' });
    }

    const { data, error } = await supabase
      .from('customer_cards')
      .upsert(
        {
          customer_id: customerId,
          card_uid: String(cardUid).toUpperCase(),
          balance: money(initialBalance),
          status: 'ACTIVE',
        },
        { onConflict: 'customer_id' }
      )
      .select('*')
      .single();
    if (error) throw error;
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.sellCard = async (req, res) => {
  try {
    const { customerId, cardUid, initialBalance = 0, notes } = req.body;
    const uid = String(cardUid || '').trim().toUpperCase();
    const loadAmount = money(initialBalance);
    if (!customerId || !uid) {
      return res.status(400).json({ success: false, message: 'Customer and RFID card UID are required' });
    }

    const { data: customer } = await supabase
      .from('users')
      .select('id, full_name, email, phone, account_status')
      .eq('id', customerId)
      .maybeSingle();
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

    const { data: taken } = await supabase
      .from('customer_cards')
      .select('id, customer_id')
      .eq('card_uid', uid)
      .maybeSingle();
    if (taken && taken.customer_id !== customerId) {
      return res.status(409).json({ success: false, message: 'This RFID card is already issued to another customer' });
    }

    const { data: existing } = await supabase
      .from('customer_cards')
      .select('*')
      .eq('customer_id', customerId)
      .maybeSingle();

    let card = existing;
    const previousUid = existing?.card_uid || null;
    if (existing) {
      const { data: updated, error } = await supabase
        .from('customer_cards')
        .update({
          card_uid: uid,
          status: 'ACTIVE',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select('*')
        .single();
      if (error) throw error;
      card = updated;
    } else {
      const { data: created, error } = await supabase
        .from('customer_cards')
        .insert({
          customer_id: customerId,
          card_uid: uid,
          balance: 0,
          status: 'ACTIVE',
        })
        .select('*')
        .single();
      if (error) throw error;
      card = created;
    }

    await supabase.from('card_transactions').insert({
      card_id: card.id,
      customer_id: customerId,
      type: 'ADJUSTMENT',
      amount: 0,
      balance_before: money(card.balance),
      balance_after: money(card.balance),
      reference: generateCode('SALE'),
      performed_by: req.user.id,
      notes: notes || `RFID card sold/issued at supermarket ${req.user.supermarketId || ''}`.trim(),
    });

    let depositResult = null;
    if (loadAmount > 0) {
      depositResult = await applyDeposit({
        card,
        amount: loadAmount,
        performedBy: req.user.id,
        notes: 'Initial load when cashier sold RFID card',
        req,
      });
      card = depositResult.updated;
    }

    await writeAudit({
      userId: req.user.id,
      action: 'CARD_SALE',
      entityType: 'customer_cards',
      entityId: card.id,
      details: { cardUid: uid, customerId, initialBalance: loadAmount, previousUid },
      ip: req.ip,
    });

    return res.status(201).json({
      success: true,
      message: loadAmount > 0 ? 'Card sold and money added' : 'RFID card sold to customer',
      data: {
        customer,
        card,
        previousUid,
        initialLoad: loadAmount,
        previousBalance: depositResult?.previousBalance ?? money(existing?.balance || 0),
        newBalance: money(card.balance),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Could not sell card' });
  }
};

exports.deposit = async (req, res) => {
  try {
    const { customerId, cardUid, amount, notes } = req.body;
    const depositAmount = money(amount);
    if (!depositAmount || depositAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid deposit amount required' });
    }

    let query = supabase.from('customer_cards').select('*, users!customer_cards_customer_id_fkey(id, full_name, email)');
    if (cardUid) query = query.eq('card_uid', String(cardUid).toUpperCase());
    else if (customerId) query = query.eq('customer_id', customerId);
    else return res.status(400).json({ success: false, message: 'customerId or cardUid required' });

    const { data: card } = await query.maybeSingle();
    if (!card) return res.status(404).json({ success: false, message: 'Card not found. Sell a card to this customer first.' });
    if (card.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'Card is not active' });
    }

    const result = await applyDeposit({
      card,
      amount: depositAmount,
      performedBy: req.user.id,
      notes: notes || 'Cashier deposit',
      req,
    });

    return res.json({
      success: true,
      message: 'Deposit successful',
      data: {
        customer: card.users,
        previousBalance: result.previousBalance,
        deposit: result.deposit,
        newBalance: result.newBalance,
        card: result.updated,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.searchCustomers = async (req, res) => {
  const q = (req.query.q || '').trim();
  const { data: role } = await supabase.from('roles').select('id').eq('name', 'CUSTOMER').single();
  let query = supabase
    .from('users')
    .select('id, full_name, email, phone, profile_image, account_status, customer_cards(*)')
    .eq('role_id', role.id)
    .limit(50);

  if (req.user.role === 'MANAGER') {
    const ids = await customerIdsForSupermarket(req.user.supermarketId);
    if (!ids.length) return res.json({ success: true, data: [] });
    query = query.in('id', ids);
  }

  if (q) {
    query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
  }
  const { data, error } = await query;
  if (error) return res.status(500).json({ success: false, message: error.message });
  return res.json({ success: true, data });
};

exports.listStoreCustomers = async (req, res) => {
  try {
    const supermarketId =
      req.user.role === 'ADMIN' ? req.query.supermarketId || req.user.supermarketId : req.user.supermarketId;
    if (!supermarketId) {
      return res.json({ success: true, data: [] });
    }

    const { data: sessions, error } = await supabase
      .from('shopping_sessions')
      .select(
        'customer_id, status, payment_status, total_amount, started_at, users!shopping_sessions_customer_id_fkey(id, full_name, email, phone, profile_image, account_status)'
      )
      .eq('supermarket_id', supermarketId)
      .order('started_at', { ascending: false });
    if (error) throw error;

    const byCustomer = new Map();
    for (const session of sessions || []) {
      const id = session.customer_id;
      if (!id) continue;
      const paid = session.payment_status === 'PAID' || session.status === 'PAID';
      const existing = byCustomer.get(id) || {
        ...session.users,
        id,
        visits: 0,
        paidVisits: 0,
        totalSpent: 0,
        lastVisit: null,
        customer_cards: [],
      };
      existing.visits += 1;
      if (paid) {
        existing.paidVisits += 1;
        existing.totalSpent = money(existing.totalSpent + Number(session.total_amount || 0));
      }
      if (!existing.lastVisit || new Date(session.started_at) > new Date(existing.lastVisit)) {
        existing.lastVisit = session.started_at;
      }
      byCustomer.set(id, existing);
    }

    const ids = [...byCustomer.keys()];
    if (ids.length) {
      const { data: cards } = await supabase.from('customer_cards').select('*').in('customer_id', ids);
      for (const card of cards || []) {
        const row = byCustomer.get(card.customer_id);
        if (row) row.customer_cards = [card];
      }
    }

    return res.json({ success: true, data: [...byCustomer.values()] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// RFID tap — identify only, NEVER deduct
exports.rfidRead = async (req, res) => {
  try {
    const { cardUid } = req.body;
    if (!cardUid) return res.status(400).json({ success: false, message: 'cardUid required' });

    const { data: card } = await supabase
      .from('customer_cards')
      .select('*, users!customer_cards_customer_id_fkey(id, full_name, email, phone, profile_image)')
      .eq('card_uid', String(cardUid).toUpperCase())
      .maybeSingle();

    if (!card) return res.status(404).json({ success: false, message: 'Unknown RFID card' });
    if (card.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: `Card status: ${card.status}` });
    }

    const { data: sessionRow } = await supabase
      .from('shopping_sessions')
      .select('id')
      .eq('customer_id', card.customer_id)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    let session = null;
    let amountDue = 0;
    if (sessionRow) {
      await recalculateSession(sessionRow.id);
      session = await getSessionFull(sessionRow.id);
      amountDue = money(session.total_amount);
    }

    let authorization = null;
    if (session && amountDue > 0) {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const { data: auth } = await supabase
        .from('payment_authorizations')
        .insert({
          customer_id: card.customer_id,
          card_id: card.id,
          session_id: session.id,
          amount: amountDue,
          status: 'PENDING',
          expires_at: expiresAt,
        })
        .select('*')
        .single();
      authorization = auth;

      const io = req.app.get('io');
      if (io) {
        io.to(`user:${card.customer_id}`).emit('payment:request', {
          authorizationId: auth.id,
          customer: card.users,
          session,
          amountToPay: amountDue,
          cardBalance: money(card.balance),
          cardUid: card.card_uid,
        });
      }
    }

    return res.json({
      success: true,
      message: 'RFID card detected. Awaiting customer PIN authorization.',
      data: {
        customer: card.users,
        card: { id: card.id, cardUid: card.card_uid, balance: money(card.balance), status: card.status },
        activeSession: session,
        amountDue,
        authorizationId: authorization?.id || null,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.authorizePayment = async (req, res) => {
  try {
    const { authorizationId, pin } = req.body;
    if (!authorizationId || !pin) {
      return res.status(400).json({ success: false, message: 'authorizationId and pin required' });
    }

    const { data: auth } = await supabase
      .from('payment_authorizations')
      .select('*')
      .eq('id', authorizationId)
      .single();

    if (!auth || auth.customer_id !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Authorization not found' });
    }
    if (auth.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: `Authorization is ${auth.status}` });
    }
    if (new Date(auth.expires_at) < new Date()) {
      await supabase.from('payment_authorizations').update({ status: 'EXPIRED' }).eq('id', auth.id);
      return res.status(400).json({ success: false, message: 'Authorization expired. Tap card again.' });
    }

    const { data: user } = await supabase.from('users').select('*').eq('id', req.user.id).single();
    if (!user.payment_pin_hash || user.payment_pin_status !== 'APPROVED') {
      return res.status(400).json({
        success: false,
        message:
          'No approved payment PIN. Create or reset your PIN, verify the email OTP, and wait for admin approval.',
      });
    }
    const pinOk = await comparePassword(String(pin), user.payment_pin_hash);
    if (!pinOk) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect PIN. Payment was not completed. Money was NOT removed.',
      });
    }

    // Recalculate final total from DB — never trust client
    const { total } = await recalculateSession(auth.session_id);
    const session = await getSessionFull(auth.session_id);
    if (session.status !== 'ACTIVE' || session.payment_status === 'PAID') {
      return res.status(400).json({ success: false, message: 'Session already paid or inactive' });
    }
    if (!session.cart_items?.length) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    const { data: card } = await supabase.from('customer_cards').select('*').eq('id', auth.card_id).single();
    const balance = money(card.balance);
    const amount = money(total);

    if (balance < amount) {
      return res.status(400).json({
        success: false,
        code: 'INSUFFICIENT_BALANCE',
        message: `INSUFFICIENT BALANCE. Card balance is ${balance} RWF. Purchase total is ${amount} RWF. You need ${money(amount - balance)} RWF more.`,
        data: { balance, amount, needed: money(amount - balance) },
      });
    }

    // Atomic-ish payment flow via sequential updates with guards
    const newBalance = money(balance - amount);

    const { data: paidCard, error: cardErr } = await supabase
      .from('customer_cards')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', card.id)
      .eq('balance', balance) // optimistic lock
      .select('*')
      .maybeSingle();

    if (cardErr || !paidCard) {
      return res.status(409).json({ success: false, message: 'Balance changed. Try again.' });
    }

    await supabase.from('card_transactions').insert({
      card_id: card.id,
      customer_id: user.id,
      type: 'PURCHASE',
      amount: -amount,
      balance_before: balance,
      balance_after: newBalance,
      reference: session.session_code,
      performed_by: user.id,
      notes: 'RFID shopping payment',
    });

    const orderCode = generateCode('ORD');
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        order_code: orderCode,
        session_id: session.id,
        customer_id: user.id,
        supermarket_id: session.supermarket_id,
        branch_id: session.branch_id,
        subtotal: amount,
        total_amount: amount,
        status: 'PAID',
      })
      .select('*')
      .single();
    if (orderErr) throw orderErr;

    const orderItems = (session.cart_items || []).map((i) => ({
      order_id: order.id,
      product_id: i.product_id,
      product_name: i.product_name,
      unit_price: i.unit_price,
      weight: i.weight,
      quantity: i.quantity,
      subtotal: i.subtotal,
    }));
    if (orderItems.length) await supabase.from('order_items').insert(orderItems);

    // Decrement inventory
    for (const item of session.cart_items || []) {
      const { data: prod } = await supabase.from('products').select('quantity_available').eq('id', item.product_id).single();
      if (prod) {
        await supabase
          .from('products')
          .update({ quantity_available: Math.max(0, prod.quantity_available - item.quantity) })
          .eq('id', item.product_id);
      }
    }

    const paymentCode = generateCode('PAY');
    const { data: payment, error: payErr } = await supabase
      .from('payments')
      .insert({
        payment_code: paymentCode,
        order_id: order.id,
        session_id: session.id,
        customer_id: user.id,
        card_id: card.id,
        amount,
        method: 'RFID_CARD',
        status: 'COMPLETED',
      })
      .select('*')
      .single();
    if (payErr) throw payErr;

    const receiptNumber = generateCode('RCPT');
    const verificationToken = require('../utils/security').generateToken(16);
    const qrPayload = `SMARTSCAN_RECEIPT:${receiptNumber}:${verificationToken}`;

    const { data: receipt, error: rErr } = await supabase
      .from('receipts')
      .insert({
        receipt_number: receiptNumber,
        verification_token: verificationToken,
        qr_payload: qrPayload,
        payment_id: payment.id,
        order_id: order.id,
        session_id: session.id,
        customer_id: user.id,
        supermarket_id: session.supermarket_id,
        branch_id: session.branch_id,
        total_amount: amount,
        status: 'ISSUED',
      })
      .select('*')
      .single();
    if (rErr) throw rErr;

    await supabase
      .from('shopping_sessions')
      .update({
        status: 'PAID',
        payment_status: 'PAID',
        total_amount: amount,
        subtotal: amount,
        completed_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    await supabase.from('payment_authorizations').update({ status: 'AUTHORIZED' }).eq('id', auth.id);

    const QRCode = require('qrcode');
    const receiptQr = await QRCode.toDataURL(qrPayload);

    const result = {
      amountPaid: amount,
      previousBalance: balance,
      remainingBalance: newBalance,
      sessionCode: session.session_code,
      order,
      payment,
      receipt: { ...receipt, qrDataUrl: receiptQr },
    };

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${user.id}`).emit('payment:success', result);
      io.to(`supermarket:${session.supermarket_id}`).emit('session:paid', { sessionId: session.id, ...result });
    }

    await writeAudit({
      userId: user.id,
      action: 'PAYMENT_AUTHORIZED',
      entityType: 'payments',
      entityId: payment.id,
      details: { amount },
      ip: req.ip,
    });

    return res.json({
      success: true,
      message: 'PAYMENT SUCCESSFUL',
      data: result,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message || 'Payment failed' });
  }
};

exports.cancelAuthorization = async (req, res) => {
  await supabase
    .from('payment_authorizations')
    .update({ status: 'CANCELLED' })
    .eq('id', req.params.id)
    .eq('customer_id', req.user.id);
  return res.json({ success: true, message: 'Payment cancelled' });
};

// silence unused import warning for hashPassword if any
void hashPassword;
