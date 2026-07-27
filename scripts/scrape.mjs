import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';

const GROUPS = JSON.parse(process.env.GROUP_URLS || '[]');
const WEBHOOK_URL = process.env.VERCEL_WEBHOOK_URL;
const MAX_POSTS = 10;

async function scrapeGroup(browser, groupUrl) {
  const page = await browser.newPage();
  const posts = [];

  try {
    console.log(`  Opening: ${groupUrl}`);
    await page.goto(groupUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);

    let prevCount = 0;
    let stallCount = 0;

    while (posts.length < MAX_POSTS && stallCount < 5) {
      const newPosts = await page.evaluate(() => {
        const items = [];
        const articles = document.querySelectorAll('[role="article"]');

        for (const el of articles) {
          try {
            const link = el.querySelector('a[href*="/posts/"], a[href*="/photo/"]');
            const url = link ? link.href : '';

            const textEl = el.querySelector('[data-ad-preview="message"], div[dir="auto"]');
            const text = textEl ? textEl.textContent.trim() : '';

            const images = [...el.querySelectorAll('img[src*="scontent"], img[src*="fbcdn"]')]
              .map(img => img.src)
              .filter(src => src && !src.includes('emoji.php') && !src.includes('static.php'));

            const authorLink = el.querySelector('a[href*="https://www.facebook.com/"]');
            const authorUrl = authorLink ? authorLink.href : '';
            const authorName = authorLink ? authorLink.textContent.trim() : '';

            const timeEl = el.querySelector('a[href*="/posts/"] time, span[data-utime], a time');
            const date = timeEl ? (timeEl.getAttribute('datetime') || timeEl.getAttribute('data-utime') || '') : '';

            if (url && text) {
              items.push({ url, text, imageUrls: images.slice(0, 10), authorName, authorUrl, date });
            }
          } catch {}
        }

        return items.filter((item, i, self) => self.findIndex(p => p.url === item.url) === i);
      });

      for (const p of newPosts) {
        if (!posts.find(x => x.url === p.url)) {
          posts.push(p);
        }
      }

      console.log(`    Found: ${posts.length} unique posts`);

      if (posts.length === prevCount) {
        stallCount++;
      } else {
        stallCount = 0;
      }
      prevCount = posts.length;

      if (posts.length < MAX_POSTS) {
        await page.evaluate(() => window.scrollBy(0, 800));
        await page.waitForTimeout(2000);
      }
    }
  } catch (err) {
    console.error(`  Error scraping ${groupUrl}:`, err.message);
  } finally {
    await page.close();
  }

  return posts.slice(0, MAX_POSTS);
}

async function main() {
  if (GROUPS.length === 0) {
    console.error('No GROUP_URLS configured in env');
    process.exit(1);
  }

  if (!WEBHOOK_URL) {
    console.error('No VERCEL_WEBHOOK_URL configured in env');
    process.exit(1);
  }

  console.log('Launching browser...');
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const allPosts = [];

  for (const groupUrl of GROUPS) {
    const posts = await scrapeGroup(browser, groupUrl);
    allPosts.push(...posts.map(p => ({
      ...p,
      groupUrl,
    })));
  }

  await browser.close();
  console.log(`\nTotal posts collected: ${allPosts.length}`);

  if (allPosts.length === 0) {
    console.log('No posts found. Exiting.');
    return;
  }

  const body = {
    eventType: 'ACTOR.RUN.SUCCEEDED',
    resource: { defaultDatasetId: 'local-scrape' },
    _mockItems: allPosts,
  };

  console.log(`Sending ${allPosts.length} posts to webhook...`);
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const result = await res.json();
  console.log('Webhook response:', JSON.stringify(result, null, 2));
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
