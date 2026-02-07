/**
 * Ultra-Fast Image Processing Script
 *
 * Usage:
 *   npx tsx scripts/process-images.ts           # Normal: regenerate meta.json, skip existing images
 *   npx tsx scripts/process-images.ts --force   # Force: re-download all images
 *
 * This script:
 * 1. Scans all JSON files in src/data/wp/ for image IDs
 * 2. Fetches image URLs from WordPress API (high concurrency)
 * 3. For each image:
 *    - If image files exist locally → only regenerate meta.json (FAST)
 *    - If image files don't exist → download and optimize
 *    - If --force flag → always re-download
 * 4. Uses worker pool for maximum performance
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../src/data/wp');
const MEDIA_JSON_DIR = path.join(__dirname, '../src/data/wp/media');
const PUBLIC_IMG_DIR = path.join(__dirname, '../public/wp-content/uploads');

// Config
const WP_API_URL = 'https://wpadmin.buildmaster.dev/wp-json/wp/v2';
const CONCURRENCY_FETCH = 50; // High concurrency for URL fetching
const CONCURRENCY_PROCESS = 10; // Moderate for image processing (CPU-bound)
const IMAGE_SIZES = [640, 1024, 1600];
const IMAGE_FORMATS = ['webp', 'avif'] as const;

// Parse CLI args
const FORCE_DOWNLOAD = process.argv.includes('--force');

interface ImageMeta {
  id: number;
  src: string;
  width: number;
  height: number;
  lqip: string;
  alt: string;
  sources: { type: string; srcset: string }[];
}

// Stats
const stats = {
  cacheHits: 0,
  regenerated: 0,
  downloaded: 0,
  errors: 0,
};

async function saveMediaJson(id: number, meta: ImageMeta) {
  if (!id) return;
  try {
    await fs.mkdir(MEDIA_JSON_DIR, { recursive: true });
    await fs.writeFile(path.join(MEDIA_JSON_DIR, `${id}.json`), JSON.stringify(meta, null, 2));
  } catch (e) {
    console.error(`Failed to save media JSON for ID ${id}`, e);
  }
}

/**
 * Ultra-fast worker pool for concurrent processing
 */
async function runPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  const runWorker = async (): Promise<void> => {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  };

  await Promise.all(Array(Math.min(concurrency, items.length)).fill(0).map(runWorker));
  return results;
}

/**
 * Fetch image URLs from WP API with high concurrency
 */
async function fetchImageUrls(
  imageIds: number[]
): Promise<Map<number, { url: string; alt: string }>> {
  const urlMap = new Map<number, { url: string; alt: string }>();
  let completed = 0;
  const total = imageIds.length;

  const fetchOne = async (id: number): Promise<void> => {
    try {
      const response = await fetch(`${WP_API_URL}/media/${id}`, {
        headers: { Accept: 'application/json' },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.source_url) {
          urlMap.set(id, {
            url: data.source_url,
            alt: data.alt_text || '',
          });
        }
      }
    } catch {
      // Ignore failures
    } finally {
      completed++;
      if (completed % 20 === 0 || completed === total) {
        process.stdout.write(`\r   Fetched ${completed}/${total} URLs`);
      }
    }
  };

  await runPool(imageIds, CONCURRENCY_FETCH, fetchOne);
  console.log('');
  return urlMap;
}

/**
 * Check if optimized images already exist locally
 */
async function hasLocalImages(baseDir: string, fileId: string): Promise<boolean> {
  try {
    // Check if at least one optimized variant exists
    const testFile = path.join(baseDir, `${fileId}-1024w.webp`);
    await fs.access(testFile);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate meta.json from existing local images (FAST - no download)
 */
async function regenerateMeta(
  baseDir: string,
  fileId: string,
  id: number,
  alt: string
): Promise<ImageMeta | null> {
  try {
    // Find the largest existing file to get dimensions
    const largestFile = path.join(baseDir, `${fileId}-1600w.webp`);
    let srcFile: string;

    try {
      await fs.access(largestFile);
      srcFile = largestFile;
    } catch {
      // Try 1024w
      const fallback = path.join(baseDir, `${fileId}-1024w.webp`);
      await fs.access(fallback);
      srcFile = fallback;
    }

    // Get dimensions from file
    const metadata = await sharp(srcFile).metadata();
    const width = metadata.width || 1200;
    const height = metadata.height || 600;

    // Generate LQIP from existing file
    const lqipBuffer = await sharp(srcFile)
      .resize(4, Math.round(4 * (height / width)), { fit: 'cover' })
      .toFormat('png')
      .toBuffer();
    const lqip = `data:image/png;base64,${lqipBuffer.toString('base64')}`;

    // Build sources from existing files
    const pathDir = path.relative(PUBLIC_IMG_DIR, baseDir).replace(/\\/g, '/');
    const sources: Record<string, string[]> = { webp: [], avif: [] };

    for (const fmt of IMAGE_FORMATS) {
      for (const w of IMAGE_SIZES) {
        const fileName = `${fileId}-${w}w.${fmt}`;
        const filePath = path.join(baseDir, fileName);
        try {
          await fs.access(filePath);
          const webPath = `/wp-content/uploads/${pathDir}/${fileName}`;
          sources[fmt].push(`${webPath} ${w}w`);
        } catch {
          // Skip missing sizes
        }
      }
    }

    const largestWebPath = `/wp-content/uploads/${pathDir}/${fileId}-1600w.webp`;

    const meta: ImageMeta = {
      id,
      src: largestWebPath,
      width,
      height,
      lqip,
      alt,
      sources: [
        { type: 'image/avif', srcset: sources.avif.join(', ') },
        { type: 'image/webp', srcset: sources.webp.join(', ') },
      ],
    };

    const metaPath = path.join(baseDir, `${id}.json`);
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
    await saveMediaJson(id, meta);

    stats.regenerated++;
    return meta;
  } catch (error) {
    return null;
  }
}

/**
 * Download and optimize image (full process)
 */
async function downloadAndOptimize(
  url: string,
  baseDir: string,
  fileId: string,
  id: number,
  alt: string,
  isSvg: boolean
): Promise<ImageMeta | null> {
  try {
    await fs.mkdir(baseDir, { recursive: true });

    // Fetch image with SSL bypass
    const { Agent } = await import('https');
    const agent = new Agent({ rejectUnauthorized: false });
    const response = await fetch(url, { agent } as any);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const buffer = Buffer.from(await response.arrayBuffer());

    // SVG handling
    if (isSvg) {
      const { optimize } = await import('svgo');
      const result = optimize(buffer.toString('utf-8'), { multipass: true });
      const outPath = path.join(baseDir, `${fileId}.svg`);
      const pathDir = path.relative(PUBLIC_IMG_DIR, baseDir).replace(/\\/g, '/');
      const webPath = `/wp-content/uploads/${pathDir}/${fileId}.svg`;

      await fs.writeFile(outPath, result.data, 'utf-8');

      const meta: ImageMeta = {
        id,
        src: webPath,
        width: 0,
        height: 0,
        lqip: '',
        alt,
        sources: [],
      };

      const metaPath = path.join(baseDir, `${id}.json`);
      await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
      await saveMediaJson(id, meta);

      stats.downloaded++;
      return meta;
    }

    // Bitmap processing
    const image = sharp(buffer);
    const metadata = await image.metadata();
    const width = metadata.width || 1200;
    const height = metadata.height || 600;

    // LQIP
    const lqipBuffer = await image
      .clone()
      .resize(4, Math.round(4 * (height / width)), { fit: 'cover' })
      .toFormat('png')
      .toBuffer();
    const lqip = `data:image/png;base64,${lqipBuffer.toString('base64')}`;

    // Generate variants
    const pathDir = path.relative(PUBLIC_IMG_DIR, baseDir).replace(/\\/g, '/');
    const sources: Record<string, string[]> = { webp: [], avif: [] };
    let largestSrc = '';

    for (const fmt of IMAGE_FORMATS) {
      for (const w of IMAGE_SIZES) {
        if (w > width && w !== 1600) continue;

        const fileName = `${fileId}-${w}w.${fmt}`;
        const outPath = path.join(baseDir, fileName);
        const webPath = `/wp-content/uploads/${pathDir}/${fileName}`;

        largestSrc = webPath;
        sources[fmt].push(`${webPath} ${w}w`);

        await image
          .clone()
          .resize(w, null, { fit: 'inside', withoutEnlargement: true })
          .toFormat(fmt, { quality: fmt === 'avif' ? 65 : 80 })
          .toFile(outPath);
      }
    }

    const meta: ImageMeta = {
      id,
      src: largestSrc,
      width,
      height,
      lqip,
      alt,
      sources: [
        { type: 'image/avif', srcset: sources.avif.join(', ') },
        { type: 'image/webp', srcset: sources.webp.join(', ') },
      ],
    };

    const metaPath = path.join(baseDir, `${id}.json`);
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
    await saveMediaJson(id, meta);

    stats.downloaded++;
    return meta;
  } catch (error) {
    stats.errors++;
    return null;
  }
}

/**
 * Process a single image - smart decision between regenerate vs download
 */
async function processImage(id: number, url: string, alt: string): Promise<ImageMeta | null> {
  try {
    const urlObj = new URL(url);
    const match = urlObj.pathname.match(/uploads\/(.+)$/);
    if (!match) return null;

    const relativePathInfo = path.parse(match[1]);
    const fileId = relativePathInfo.name.replace(/\.(jpg|jpeg|png|webp|avif)$/i, '');
    const isSvg = relativePathInfo.ext.toLowerCase() === '.svg';

    const baseDir = path.join(PUBLIC_IMG_DIR, relativePathInfo.dir);
    const metaPath = path.join(baseDir, `${fileId}.meta.json`);

    // Check if local files exist
    const hasLocal = isSvg
      ? await fs
          .access(path.join(baseDir, `${fileId}.svg`))
          .then(() => true)
          .catch(() => false)
      : await hasLocalImages(baseDir, fileId);

    if (hasLocal && !FORCE_DOWNLOAD) {
      // Fast path: just regenerate meta.json from existing files
      return await regenerateMeta(baseDir, fileId, id, alt);
    }

    // Slow path: download and optimize
    return await downloadAndOptimize(url, baseDir, fileId, id, alt, isSvg);
  } catch {
    stats.errors++;
    return null;
  }
}

/**
 * Collect all image IDs from JSON files
 */
async function collectImageIds(): Promise<Set<number>> {
  const imageIds = new Set<number>();

  const scanDir = async (dir: string) => {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await scanDir(fullPath);
      } else if (entry.name.endsWith('.json') && !entry.name.endsWith('.meta.json')) {
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          const data = JSON.parse(content);

          const extractIds = (obj: any): void => {
            if (typeof obj !== 'object' || obj === null) return;

            if (Array.isArray(obj)) {
              obj.forEach((item) => {
                if (typeof item === 'number') imageIds.add(item);
                else extractIds(item);
              });
              return;
            }

            for (const [key, value] of Object.entries(obj)) {
              // Known image fields
              if (
                [
                  'image',
                  'gallery',
                  'gallery_images',
                  'thumbnail',
                  'featured_media',
                  'bg_image',
                ].includes(key)
              ) {
                if (typeof value === 'number') imageIds.add(value);
                else if (Array.isArray(value)) {
                  value.forEach((v) => typeof v === 'number' && imageIds.add(v));
                } else if (typeof value === 'object' && value && 'id' in value) {
                  imageIds.add((value as any).id);
                }
              }
              // Logos object
              if (key === 'logos' && typeof value === 'object') {
                Object.values(value as object).forEach((logo: any) => {
                  if (logo?.id) imageIds.add(logo.id);
                });
              }
              if (typeof value === 'object') extractIds(value);
            }
          };

          extractIds(data);
        } catch {
          /* Skip invalid JSON */
        }
      }
    }
  };

  await scanDir(DATA_DIR);
  return imageIds;
}

/**
 * Main entry point
 */
async function main() {
  console.log('🖼️  Ultra-Fast Image Processing');
  console.log('================================\n');

  if (FORCE_DOWNLOAD) {
    console.log('⚠️  FORCE MODE: Will re-download all images\n');
  } else {
    console.log('📦 SMART MODE: Only regenerate meta.json for existing images\n');
  }

  const startTime = Date.now();

  // Step 1: Collect IDs
  console.log('1. Scanning JSON files for image IDs...');
  const imageIds = await collectImageIds();
  const idArray = Array.from(imageIds);
  console.log(`   Found ${idArray.length} unique image IDs\n`);

  if (idArray.length === 0) {
    console.log('No images found. Done!');
    return;
  }

  // Step 2: Fetch URLs (high concurrency)
  console.log(`2. Fetching URLs from WordPress (${CONCURRENCY_FETCH} concurrent)...`);
  const urlMap = await fetchImageUrls(idArray);
  console.log(`   Resolved ${urlMap.size} valid URLs\n`);

  if (urlMap.size === 0) {
    console.log('No valid URLs found.');
    return;
  }

  // Step 3: Process images
  console.log(`3. Processing images (${CONCURRENCY_PROCESS} concurrent)...`);
  const entries = Array.from(urlMap.entries());
  let processed = 0;

  await runPool(entries, CONCURRENCY_PROCESS, async ([id, data]) => {
    await processImage(id, data.url, data.alt);
    processed++;
    if (processed % 10 === 0 || processed === entries.length) {
      process.stdout.write(
        `\r   ${processed}/${entries.length} (cache: ${stats.regenerated}, dl: ${stats.downloaded}, err: ${stats.errors})`
      );
    }
  });

  console.log('\n');

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('📊 Summary:');
  console.log(`   ✓ Regenerated meta.json: ${stats.regenerated}`);
  console.log(`   ⬇ Downloaded & optimized: ${stats.downloaded}`);
  console.log(`   ✗ Errors: ${stats.errors}`);
  console.log(`\n✅ Done in ${elapsed}s`);
}

main().catch(console.error);
