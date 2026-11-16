// One-time script to download Pexels images for homepage
// Run: node scripts/download-home-images.mjs
// Delete after use.

import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

const OUT = 'assets/images/home';

const images = [
  // Hero (landscape 1920×800)
  { name: 'hero-1-discover.jpg', id: 972887, w: 1920, h: 800 },
  { name: 'hero-2-fashion.jpg', id: 37080686, w: 1920, h: 800 },
  { name: 'hero-3-home.jpg', id: 5824901, w: 1920, h: 800 },
  { name: 'hero-4-electronics.jpg', id: 5208359, w: 1920, h: 800 },
  // Category (square 600×600)
  { name: 'banner.jpg', id: 37080706, w: 600, h: 600 },
  { name: 'cat-fashion.jpg', id: 37080706, w: 600, h: 600 },
  { name: 'cat-home-garden.jpg', id: 30355548, w: 600, h: 600 },
  { name: 'cat-electronics.jpg', id: 5081386, w: 600, h: 600 },
  { name: 'cat-health-beauty.jpg', id: 9496253, w: 600, h: 600 },
  { name: 'cat-sports-outdoors.jpg', id: 29300647, w: 600, h: 600 },
  { name: 'cat-industrial.jpg', id: 31352672, w: 600, h: 600 },
  // Trending (portrait 600×800)
  { name: 'trend-1.jpg', id: 7460139, w: 600, h: 800 },
  { name: 'trend-2.jpg', id: 3777932, w: 600, h: 800 },
  { name: 'trend-3.jpg', id: 705868, w: 600, h: 800 },
  { name: 'trend-4.jpg', id: 11705153, w: 600, h: 800 },
  { name: 'trend-5.jpg', id: 31305965, w: 600, h: 800 },
  { name: 'trend-6.jpg', id: 13516802, w: 600, h: 800 },
  { name: 'trend-7.jpg', id: 6805426, w: 600, h: 800 },
  { name: 'trend-8.jpg', id: 2529159, w: 600, h: 800 },
  // New Arrivals (portrait 600×800)
  { name: 'new-1.jpg', id: 6650001, w: 600, h: 800 },
  { name: 'new-2.jpg', id: 20118030, w: 600, h: 800 },
  { name: 'new-3.jpg', id: 30970926, w: 600, h: 800 },
  { name: 'new-4.jpg', id: 15569140, w: 600, h: 800 },
  { name: 'new-5.jpg', id: 8166613, w: 600, h: 800 },
  { name: 'new-6.jpg', id: 12730136, w: 600, h: 800 },
  { name: 'new-7.jpg', id: 1005058, w: 600, h: 800 },
  { name: 'new-8.jpg', id: 34978686, w: 600, h: 800 },
  // Featured seller (900×700)
  { name: 'featured-seller.jpg', id: 7857532, w: 900, h: 700 },
  // Become a seller (1600×700)
  { name: 'become-seller.jpg', id: 7857542, w: 1600, h: 700 },
];

async function download(img) {
  const path = `${OUT}/${img.name}`;
  if (existsSync(path)) {
    console.log(`SKIP ${img.name} (exists)`);
    return;
  }
  const url = `https://images.pexels.com/photos/${img.id}/pexels-photo-${img.id}.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=${img.w}&h=${img.h}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(path, buf);
    console.log(`OK   ${img.name} (${(buf.length / 1024).toFixed(0)} KB)`);
  } catch (e) {
    console.error(`FAIL ${img.name}: ${e.message}`);
  }
}

await mkdir(OUT, { recursive: true });

// Download 4 at a time
for (let i = 0; i < images.length; i += 4) {
  await Promise.all(images.slice(i, i + 4).map(download));
}

console.log('\nDone.');

