import { createClient } from '@supabase/supabase-js';

let client;

export function getClient() {
  if (!client) {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
    if (!url) throw new Error('Missing SUPABASE_URL in env');
    client = createClient(url, key);
  }
  return client;
}

export async function uploadImage(leadId, filename, buffer, mimeType) {
  const supabase = getClient();
  const path = `${leadId}/${filename}`;

  const { error } = await supabase.storage
    .from('lead-images')
    .upload(path, buffer, { contentType: mimeType, upsert: false });

  if (error) throw error;

  const { data: publicUrl } = supabase.storage
    .from('lead-images')
    .getPublicUrl(path);

  return publicUrl.publicUrl;
}

export async function downloadAndUploadImages(leadId, imageUrls) {
  const uploaded = [];

  for (let i = 0; i < Math.min(imageUrls.length, 10); i++) {
    try {
      const res = await fetch(imageUrls[i], { signal: AbortSignal.timeout(15000) });
      if (!res.ok) continue;

      const buffer = Buffer.from(await res.arrayBuffer());
      const contentType = res.headers.get('content-type') || 'image/jpeg';
      const ext = contentType.split('/')[1] || 'jpg';
      const filename = `${i + 1}.${ext}`;

      const url = await uploadImage(leadId, filename, buffer, contentType);
      uploaded.push(url);
    } catch (err) {
      console.error(`Image download failed: ${imageUrls[i]} — ${err.message}`);
    }
  }

  return uploaded;
}

export async function insertLead(lead) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('leads')
    .insert(lead)
    .select('id')
    .single();

  if (error) throw error;
  return data;
}
