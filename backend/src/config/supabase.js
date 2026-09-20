const { createClient } = require('@supabase/supabase-js');
const config = require('./env');

if (!config.supabaseUrl || !config.supabaseServiceKey) {
  console.warn(
    '[SMARTSCAN] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing. Database calls will fail until configured.'
  );
}

const supabase = createClient(
  config.supabaseUrl || 'https://placeholder.supabase.co',
  config.supabaseServiceKey || 'placeholder',
  {
    auth: { persistSession: false, autoRefreshToken: false },
  }
);

module.exports = { supabase };
