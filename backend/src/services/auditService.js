const { supabase } = require('../config/supabase');

async function writeAudit({ userId, action, entityType, entityId, details, ip }) {
  try {
    await supabase.from('audit_logs').insert({
      user_id: userId || null,
      action,
      entity_type: entityType || null,
      entity_id: entityId ? String(entityId) : null,
      details: details || null,
      ip_address: ip || null,
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

module.exports = { writeAudit };
