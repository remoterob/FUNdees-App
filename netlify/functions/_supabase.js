// netlify/functions/_supabase.js
// Shared admin client — imported by all functions
// Uses SERVICE ROLE key (never exposed to browser)

const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,  // NOT the anon key — full admin access
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

module.exports = { supabaseAdmin };
