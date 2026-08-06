const APIFY_BASE = 'https://api.apify.com/v2';

async function safeJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Apify API returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
}

export async function startActorRun(groupUrl, webhookUrl, resultsLimit, webhookData = {}) {
  const actorId = process.env.APIFY_ACTOR_ID.replace('/', '~');
  const url = groupUrl.trim();

  const body = {
    startUrls: [{ url }],
    resultsLimit: resultsLimit || 10,
    proxy: { useApifyProxy: true, apifyProxyGroups: ["RESIDENTIAL"] },
    extractPostDates: true,
  };
  if (webhookUrl) {
    body.webhookUrls = [{
      requestUrl: webhookUrl,
      eventTypes: ['ACTOR.RUN.SUCCEEDED'],
      data: { groupUrl: url, ...webhookData },
    }];
  }

  const res = await fetch(
    `${APIFY_BASE}/acts/${actorId}/runs?token=${process.env.APIFY_API_KEY}&memory=1024`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    throw new Error(`Apify run failed (${res.status}): ${await res.text()}`);
  }

  return safeJson(res);
}

export async function getDatasetItems(datasetId) {
  const res = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?token=${process.env.APIFY_API_KEY}&format=json`,
  );

  if (!res.ok) {
    throw new Error(`Apify dataset fetch failed (${res.status})`);
  }

  return safeJson(res);
}

export async function startAllRuns(sources, webhookUrl, resultsLimit) {
  return Promise.all(sources.map(s => startActorRun(s.source_url, webhookUrl, s.results_limit, {
    sourceId: s.id,
    sourceName: s.label,
  })));
}
