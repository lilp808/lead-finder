import { fetchSearchPage, buildSearchUrl } from '../src/lib/ddproperty.js';

const DEFAULT_URL =
  'https://www.ddproperty.com/en/property-for-rent?locale=th&listingType=rent&propertyTypeGroup=C&propertyTypeCode=WAR&isCommercial=true';

const searchUrl = process.argv[2] || DEFAULT_URL;
const quota = Number(process.argv[3]) || 10;

async function main() {
  console.log(`Search: ${searchUrl}`);
  console.log(`Quota (test): ${quota} units\n`);

  const collected = [];
  let page = 1;
  let totalPages = null;
  let resultCount = null;

  while (collected.length < quota) {
    const result = await fetchSearchPage(searchUrl, page);
    totalPages = result.totalPages;
    resultCount = result.resultCount;

    console.log(`--- page ${result.currentPage}/${totalPages} (resultCount=${resultCount}) -> ${result.listings.length} listings ---`);

    for (const listing of result.listings) {
      if (collected.length >= quota) break;
      collected.push(listing);
      console.log(`\n  [${collected.length}] ${listing.id}`);
      console.log(`      title:   ${listing.title}`);
      console.log(`      price:   ${listing.pricePretty}  (${listing.currency} ${listing.priceValue})`);
      console.log(`      type:    ${listing.propertyType}`);
      console.log(`      area:    land ${listing.landAreaText} | floor ${listing.floorAreaSqm} sqm | ${listing.listingFeatures.join('; ')}`);
      console.log(`      address: ${listing.fullAddress}`);
      console.log(`      province:${listing.province} | ${listing.district} | ${listing.subDistCode}`);
      console.log(`      agent:   ${listing.agentName} (#${listing.agentId}, verified:${listing.agentVerified})`);
      console.log(`      posted:  ${listing.postedAtUnix}`);
      console.log(`      images:  ${listing.imageUrls.length}`);
      console.log(`      url:     ${listing.url}`);
      console.log(`      featured:${listing.badges.join(', ')}`);
    }

    if (totalPages != null && page >= totalPages) break;
    if (!result.listings.length) break;
    page += 1;
  }

  const imgCounts = collected.map(l => l.imageUrls.length);
  console.log(`\n\n=== SUMMARY ===`);
  console.log(`collected:      ${collected.length}`);
  console.log(`pages read:     ${page}`);
  console.log(`totalPages:     ${totalPages}`);
  console.log(`resultCount:    ${resultCount}`);
  console.log(`images total:   ${imgCounts.reduce((a, b) => a + b, 0)}`);
  console.log(`images min/max: ${Math.min(...imgCounts)} / ${Math.max(...imgCounts)}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});