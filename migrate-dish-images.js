// migrate-dish-images.js
// Run once: node migrate-dish-images.js
// Downloads all dish photos from Fish Bingo storage and re-uploads to Fundees storage.
// Then updates the dish_archive rows with the new URLs.
//
// Prerequisites:
//   npm install @supabase/supabase-js node-fetch
//   Set FUNDEES_SERVICE_KEY env var (Supabase service role key)

const { createClient } = require('@supabase/supabase-js');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const path = require('path');

const FUNDEES_URL = 'https://ldlvzkjdbsabwyubdtly.supabase.co';
const FUNDEES_SERVICE_KEY = process.env.FUNDEES_SERVICE_KEY; // set this before running

if (!FUNDEES_SERVICE_KEY) {
  console.error('Set FUNDEES_SERVICE_KEY env var first');
  process.exit(1);
}

const sb = createClient(FUNDEES_URL, FUNDEES_SERVICE_KEY);

async function downloadBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function contentType(url) {
  const ext = url.split('?')[0].split('.').pop().toLowerCase();
  const map = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
                webp: 'image/webp', gif: 'image/gif' };
  return map[ext] || 'image/jpeg';
}

async function migrateImage(url, destPath) {
  if (!url || url === 'null') return null;
  try {
    const buf = await downloadBuffer(url);
    const ct  = contentType(url);
    const { error } = await sb.storage.from('Fundees').upload(destPath, buf, {
      contentType: ct, upsert: true
    });
    if (error) throw error;
    const { data } = sb.storage.from('Fundees').getPublicUrl(destPath);
    return data.publicUrl;
  } catch (err) {
    console.warn(`  ⚠ Failed to migrate ${url}: ${err.message}`);
    return url; // keep original as fallback
  }
}

async function run() {
  console.log('Loading dishes_archive...');
  const { data: dishes, error } = await sb.from('dishes_archive').select('*');
  if (error) { console.error(error); process.exit(1); }
  console.log(`Found ${dishes.length} dishes to migrate\n`);

  for (const d of dishes) {
    console.log(`[${d.id.slice(0,8)}] ${d.name} (${d.species_slug})`);

    const ext  = (d.photo_url || '').split('.').pop().split('?')[0].toLowerCase() || 'jpg';
    const base = `dishes/${d.species_slug}-${d.id.slice(0,8)}`;

    const newPhotoUrl = await migrateImage(d.photo_url, `${base}.${ext}`);
    const newThumbUrl = await migrateImage(d.thumb_url, `${base}-thumb.jpg`);

    const { error: upErr } = await sb.from('dishes_archive')
      .update({ photo_url: newPhotoUrl, thumb_url: newThumbUrl || newPhotoUrl })
      .eq('id', d.id);

    if (upErr) console.warn(`  ⚠ Update failed: ${upErr.message}`);
    else console.log(`  ✓ ${newPhotoUrl}`);

    // Small delay to avoid hammering storage
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n✅ Migration complete');
}

run().catch(console.error);
