const APIFY_BASE = 'https://api.apify.com/v2';

export async function startActorRun(groupUrl, webhookUrl) {
  const actorId = process.env.APIFY_ACTOR_ID.replace('/', '~');
  const url = groupUrl.trim();

  const input = {
    startUrls: [{ url }],
    resultsLimit: 10,
    proxy: { useApifyProxy: true },
  };

  const res = await fetch(
    `${APIFY_BASE}/acts/${actorId}/runs?token=${process.env.APIFY_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...input,
        webhookUrls: [webhookUrl],
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`Apify run failed (${res.status}): ${await res.text()}`);
  }

  return res.json();
}

export async function getDatasetItems(datasetId) {
  const res = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?token=${process.env.APIFY_API_KEY}&format=json`,
  );

  if (!res.ok) {
    throw new Error(`Apify dataset fetch failed (${res.status})`);
  }

  return res.json();
}

export async function startAllRuns(groupUrls, webhookUrl) {
  return Promise.all(groupUrls.map(url => startActorRun(url, webhookUrl)));
}
