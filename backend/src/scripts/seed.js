require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { supabase } = require('../config/supabase');
const { hashPassword } = require('../utils/security');

async function upsertUser({ fullName, email, password, roleName, status = 'APPROVED', pin }) {
  const { data: role } = await supabase.from('roles').select('id').eq('name', roleName).single();
  if (!role) throw new Error(`Role ${roleName} missing — run schema.sql`);

  const passwordHash = await hashPassword(password);
  const paymentPinHash = pin ? await hashPassword(pin) : null;

  const { data: existing } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
  if (existing) {
    await supabase
    .from('users')
    .update({
      full_name: fullName,
      password_hash: passwordHash,
      payment_pin_hash: paymentPinHash,
      payment_pin_status: pin ? 'APPROVED' : 'NONE',
      role_id: role.id,
      email_verified: true,
      account_status: status,
      is_active: true,
    })
    .eq('id', existing.id);
    return existing.id;
  }

  const { data, error } = await supabase
    .from('users')
    .insert({
      full_name: fullName,
      email,
      password_hash: passwordHash,
      payment_pin_hash: paymentPinHash,
      payment_pin_status: pin ? 'APPROVED' : 'NONE',
      role_id: role.id,
      email_verified: true,
      account_status: status,
      is_active: true,
      phone: '0780000000',
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function main() {
  console.log('Seeding SMARTSCAN...');

  const adminId = await upsertUser({
    fullName: 'System Admin',
    email: 'admin@smartscan.rw',
    password: 'Password123!',
    roleName: 'ADMIN',
  });

  const managerId = await upsertUser({
    fullName: 'Alice Manager',
    email: 'manager@smartscan.rw',
    password: 'Password123!',
    roleName: 'MANAGER',
  });

  const cashierId = await upsertUser({
    fullName: 'Bob Cashier',
    email: 'cashier@smartscan.rw',
    password: 'Password123!',
    roleName: 'CASHIER',
  });

  const customerId = await upsertUser({
    fullName: 'John Doe',
    email: 'customer@smartscan.rw',
    password: 'Password123!',
    roleName: 'CUSTOMER',
    pin: '1234',
  });

  let { data: market } = await supabase.from('supermarkets').select('*').eq('name', 'ABC Supermarket').maybeSingle();
  if (!market) {
    const { data, error } = await supabase
      .from('supermarkets')
      .insert({
        name: 'ABC Supermarket',
        description: 'Demo SMARTSCAN supermarket',
        address: 'Kigali, Rwanda',
        phone: '0781111111',
        email: 'abc@smartscan.rw',
        owner_id: managerId,
        status: 'ACTIVE',
      })
      .select('*')
      .single();
    if (error) throw error;
    market = data;
  }

  let { data: branch } = await supabase
    .from('branches')
    .select('*')
    .eq('code', 'BRANCH-001')
    .maybeSingle();
  if (!branch) {
    const { data, error } = await supabase
      .from('branches')
      .insert({
        supermarket_id: market.id,
        name: 'Kigali Main Branch',
        code: 'BRANCH-001',
        address: 'KN 1 Ave, Kigali',
        qr_payload: 'SMARTSCAN_BRANCH:BRANCH-001',
        status: 'ACTIVE',
      })
      .select('*')
      .single();
    if (error) throw error;
    branch = data;
  }

  await supabase
    .from('users')
    .update({ supermarket_id: market.id, branch_id: branch.id })
    .in('id', [managerId, cashierId]);

  const products = [
    { name: 'Milk', price: 2000, weight: 1, unit: 'L', code: 'PROD-000101' },
    { name: 'Rice', price: 3500, weight: 2, unit: 'kg', code: 'PROD-000102' },
    { name: 'Sugar', price: 1500, weight: 1, unit: 'kg', code: 'PROD-000103' },
  ];

  for (const p of products) {
    const qr = `SMARTSCAN_PRODUCT:${p.code}`;
    const { data: existing } = await supabase.from('products').select('id').eq('product_code', p.code).maybeSingle();
    if (!existing) {
      await supabase.from('products').insert({
        supermarket_id: market.id,
        branch_id: branch.id,
        name: p.name,
        sku: p.code,
        category: 'Grocery',
        price: p.price,
        weight: p.weight,
        unit: p.unit,
        quantity_available: 100,
        product_code: p.code,
        qr_payload: qr,
        status: 'ACTIVE',
      });
    }
  }

  const { data: card } = await supabase.from('customer_cards').select('id').eq('customer_id', customerId).maybeSingle();
  if (!card) {
    await supabase.from('customer_cards').insert({
      customer_id: customerId,
      card_uid: 'A4B2C199',
      balance: 20000,
      status: 'ACTIVE',
    });
  } else {
    await supabase.from('customer_cards').update({ card_uid: 'A4B2C199', balance: 20000, status: 'ACTIVE' }).eq('id', card.id);
  }

  await supabase.from('iot_devices').upsert(
    {
      device_code: 'IOT-RFID-001',
      name: 'Main RFID Reader',
      type: 'RFID_READER',
      supermarket_id: market.id,
      branch_id: branch.id,
      api_key: process.env.IOT_API_KEY || 'smartscan-iot-device-key-2026',
      status: 'ACTIVE',
    },
    { onConflict: 'device_code' }
  );

  console.log('Seed complete.');
  console.log({
    admin: 'admin@smartscan.rw / Password123!',
    manager: 'manager@smartscan.rw / Password123!',
    cashier: 'cashier@smartscan.rw / Password123!',
    customer: 'customer@smartscan.rw / Password123! (PIN 1234, card A4B2C199, balance 20000)',
    branchQr: 'SMARTSCAN_BRANCH:BRANCH-001',
    productQrs: products.map((p) => `SMARTSCAN_PRODUCT:${p.code}`),
    adminId,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
