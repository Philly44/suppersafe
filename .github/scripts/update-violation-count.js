const https = require('https');
const fs = require('fs');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function getViolationCount() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

  const url = `${SUPABASE_URL}/rest/v1/dinesafe?select=establishment_id&inspection_date=gte.${dateStr}&or=(severity.ilike.C*,severity.ilike.S*)`;

  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const records = JSON.parse(data);
          if (Array.isArray(records)) {
            const unique = new Set(records.map(r => r.establishment_id));
            resolve(unique.size);
          } else {
            console.error('Unexpected response:', data);
            reject(new Error('Invalid response from Supabase'));
          }
        } catch (e) {
          console.error('Parse error:', e, 'Data:', data);
          reject(e);
        }
      });
    });
    req.on('error', reject);
  });
}

async function updateHtml(count) {
  const htmlPath = './index.html';
  let html = fs.readFileSync(htmlPath, 'utf8');

  // Update og:description and twitter:description
  html = html.replace(
    /(\d+) Toronto restaurants got critical violations last month/g,
    `${count} Toronto restaurants got critical violations last month`
  );

  fs.writeFileSync(htmlPath, html);
  console.log(`Updated violation count to ${count}`);
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
    process.exit(1);
  }

  const count = await getViolationCount();
  console.log(`Found ${count} restaurants with critical violations in last 30 days`);
  await updateHtml(count);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
