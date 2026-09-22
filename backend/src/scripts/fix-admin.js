/**
 * One-time fix: restore admin@smartscan.rw to ADMIN role,
 * clear any supermarket_id / branch_id that was wrongly assigned.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { supabase } = require('../config/supabase');
const { hashPassword } = require('../utils/security');

async function main() {
  console.log('Fixing admin account...');

  // 1. Get ADMIN role id
  const { data: role, error: roleErr } = await supabase
    .from('roles')
    .select('id')
    .eq('name', 'ADMIN')
    .single();

  if (roleErr || !role) throw new Error('ADMIN role not found in DB');

  // 2. Find admin user
  const { data: admin, error: findErr } = await supabase
    .from('users')
    .select('id, role_id, supermarket_id, branch_id')
    .eq('email', 'admin@smartscan.rw')
    .maybeSingle();

  if (findErr) throw findErr;
  if (!admin) throw new Error('admin@smartscan.rw not found — run seed.js first');

  console.log('Current admin record:', admin);

  // 3. Restore ADMIN role, clear supermarket / branch binding
  const passwordHash = await hashPassword('Password123!');
  const { error: updateErr } = await supabase
    .from('users')
    .update({
      role_id: role.id,
      supermarket_id: null,
      branch_id: null,
      password_hash: passwordHash,
      email_verified: true,
      account_status: 'APPROVED',
      is_active: true,
    })
    .eq('id', admin.id);

  if (updateErr) throw updateErr;

  console.log('✅  admin@smartscan.rw is now ADMIN with no supermarket binding.');
  console.log('   Login: admin@smartscan.rw / Password123!');
}

main().catch((e) => {
  console.error('❌ ', e.message);
  process.exit(1);
});
