import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const SEC_CH_UA = '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"';

export const DD_DEFAULT_PAGE_SIZE = 20;
export const DD_FETCH_RETRIES = 4;
export const DD_RETRY_DELAY_MS = 3000;

export function buildSearchUrl(baseUrl, page) {
  if (!baseUrl) throw new Error('Missing DDProperty search URL');
  const url = new URL(baseUrl);
  url.searchParams.set('page', String(page));
  return url.toString();
}

const CURL_BIN = process.env.CURL_BIN || 'curl';

// ddproperty sits behind Cloudflare that rejects Node's TLS fingerprint (undici)
// but lets real `curl` through. Prefer the system curl binary; fall back to fetch.
async function fetchHtml(url) {
  let useCurl = true;
  if (process.env.DD_USE_NODE_FETCH === '1') useCurl = false;

  if (useCurl) {
    try {
      const { stdout } = await execFileAsync(CURL_BIN, [
        '-L', '--http1.1', '-sS',
        '-A', UA,
        '-H', `sec-ch-ua: ${SEC_CH_UA}`,
        '-H', 'Accept: text/html',
        '-H', 'Accept-Language: en-US,en;q=0.9',
        url,
      ], { timeout: 30000, maxBuffer: 20 * 1024 * 1024 });
      return stdout;
    } catch (err) {
      if (err.code === 'ENOENT' && process.env.DD_USE_NODE_FETCH !== '1') {
        console.warn('DD: curl not found, falling back to node fetch (may hit Cloudflare)');
        useCurl = false;
      } else {
        throw err;
      }
    }
  }

  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'sec-ch-ua': SEC_CH_UA,
      'Accept': 'text/html',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    throw new Error(`DD node fetch failed (${res.status}) for ${url}`);
  }
  return res.text();
}

export async function fetchSearchPage(searchUrl, page = 1) {
  const url = buildSearchUrl(searchUrl, page);
  let lastErr;

  for (let attempt = 1; attempt <= DD_FETCH_RETRIES; attempt++) {
    try {
      const html = await fetchHtml(url);
      if (html.includes('Just a moment...')) {
        throw new Error(`DD Cloudflare challenge on page ${page}`);
      }
      return parseSearchHtml(html);
    } catch (err) {
      lastErr = err;
      if (attempt < DD_FETCH_RETRIES) {
        await new Promise(r => setTimeout(r, DD_RETRY_DELAY_MS * attempt));
      }
    }
  }

  throw lastErr;
}

export function parseSearchHtml(html) {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('DD: __NEXT_DATA__ block not found');

  const next = JSON.parse(m[1]);
  const pd = next.props?.pageProps?.pageData;
  if (!pd) throw new Error('DD: pageData not found');

  const data = pd.data || {};
  const listingsData = Array.isArray(data.listingsData) ? data.listingsData : [];
  const pagination = data.paginationData || {};

  return {
    listings: listingsData.map(item => mapListing(item)),
    resultCount: pd.resultCount ?? null,
    totalPages: pagination.totalPages ? Number(pagination.totalPages) : null,
    currentPage: pagination.currentPage ? Number(pagination.currentPage) : pageFrom(next),
  };
}

function pageFrom(next) {
  const q = next.query || {};
  return Number(q.page) || 1;
}

export function mapListing(item) {
  const listing = item.listingData || {};
  const price = listing.price || {};
  const subTypeText = listing.property?.subTypeText || listing.subTypeText || '';
  const additional = listing.additionalData || {};
  const agent = listing.agent || {};

  const imageUrls = ((listing.mediaCarousel?.previewMedia?.images?.items) || [])
    .map(img => img.src)
    .filter(Boolean);

  const priceText = price.pretty || '';
  const priceUnit = priceText.includes('/yr') ? 'year' : priceText.includes('/mo') ? 'month' : 'total';

  const propertyTypeMap = {
    'Warehouse/Factory': 'warehouse_factory',
    'Warehouse': 'warehouse',
    'Factory': 'factory',
  };

  return {
    id: listing.id,
    url: listing.url,
    title: listing.localizedTitle || '',
    description: listing.agent?.description || '',
    fullAddress: listing.fullAddress || '',
    shortAddress: listing.shortAddress || '',
    price: price.value ?? null,
    priceValue: price.value ?? null,
    pricePretty: priceText,
    priceUnit: priceUnit,
    currency: price.currency || 'THB',
    pricePerAreaText: listing.pricePerArea?.localeStringValue || listing.psfText || '',
    floorAreaSqm: listing.floorArea ? Number(listing.floorArea) : null,
    landAreaText: listing.area?.localeStringValue || '',
    bedrooms: listing.bedrooms != null ? Number(listing.bedrooms) : null,
    bathrooms: listing.bathrooms != null ? Number(listing.bathrooms) : null,
    tenure: additional.tenure || null,
    propertyType: propertyTypeMap[subTypeText] || subTypeText || '',
    typeText: listing.typeText || '',
    subTypeText: subTypeText,
    statusCode: listing.statusCode || '',
    province: additional.regionText || '',
    provinceCode: additional.regionCode || null,
    district: additional.districtText || '',
    districtCode: additional.districtCode || null,
    subDistCode: additional.areaCode || null,
    agentId: agent.id || null,
    agentName: agent.name || '',
    agentAgencyId: agent.agencyId || null,
    agentProfileUrl: agent.profileUrl || '',
    agentAvatarSrc: agent.avatar?.src || '',
    agentVerified: agent.isAgentVerified === 'true',
    postedAtUnix: listing.postedOn?.unix ? Number(listing.postedOn.unix) : null,
    isVerified: listing.isVerified === 'true',
    isOfficialListing: listing.isOfficialListing === 'true',
    isDeveloperListing: listing.isDeveloperListing === 'true',
    imageUrls,
    badges: ((listing.badges) || []).map(b => b.text).filter(Boolean),
    listingFeatures: ((listing.listingFeatures) || []).map(f => f.text).filter(Boolean),
  };
}