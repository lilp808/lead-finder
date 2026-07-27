import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function setup() {
  console.log('Creating storage bucket: lead-images...');

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;

  const exists = buckets.some(b => b.name === 'lead-images');
  if (exists) {
    console.log('Bucket lead-images already exists.');
  } else {
    const { error } = await supabase.storage.createBucket('lead-images', {
      public: true,
    });
    if (error) throw error;
    console.log('Bucket lead-images created.');
  }

  console.log('');
  console.log('Setup complete!');
  console.log('Next steps:');
  console.log('  1. Go to Supabase Dashboard > SQL Editor');
  console.log('  2. Run the SQL from src/schema.sql');
  console.log('  3. Copy .env.example to .env.local and fill in values');
  console.log('  4. Run: npm run dev');
}

setup().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
