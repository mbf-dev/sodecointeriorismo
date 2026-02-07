import type { APIRoute } from 'astro';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const PUBLIC_IMG_DIR = path.join(process.cwd(), 'public/wp-content/uploads');
const WP_BASE = 'https://wpadmin.buildmaster.dev';

// Image sizes to generate
const IMAGE_SIZES = [640, 1024, 1600];
const IMAGE_FORMATS = ['webp', 'avif'] as const;

interface ImageMeta {
  id: number;
  src: string;
  width: number;
  height: number;
  lqip: string;
  alt: string;
  sources: { type: string; srcset: string }[];
}

/**
 * POST /api/sync-image
 * Body: { id: number, url: string, alt?: string }
 *
 * Syncs a single image. If already exists (meta.json present), returns cached data.
 * Otherwise downloads, optimizes, and creates meta.json.
 */
export const POST: APIRoute = async ({ request }) => {
  const token = request.headers.get('x-sync-token');
  if (token !== 'sodeco_secure_sync_token') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, url, alt = '' } = body;

    if (!id || !url) {
      return new Response(JSON.stringify({ error: 'Missing id or url' }), { status: 400 });
    }

    const result = await syncImage(id, url, alt);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[SyncImage] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
};

/**
 * Sync a single image - check cache first, then download and optimize if needed
 * @param id Image ID
 * @param url Image URL
 * @param alt Alt text
 * @param forceDownload If true, bypass cache and re-download
 */
export async function syncImage(
  id: number,
  url: string,
  alt: string = '',
  forceDownload: boolean = false
): Promise<ImageMeta | null> {
  try {
    // Parse URL to get relative path
    const urlObj = new URL(url);
    const match = urlObj.pathname.match(/uploads\/(.+)$/);
    if (!match) {
      console.error(`[SyncImage] Invalid URL format: ${url}`);
      return null;
    }

    const relativePath = match[1];
    const pathInfo = path.parse(relativePath);
    const fileId = pathInfo.name;
    const ext = pathInfo.ext.toLowerCase();
    const isSvg = ext === '.svg';

    const baseDir = path.join(PUBLIC_IMG_DIR, pathInfo.dir);
    const metaPath = path.join(baseDir, `${fileId}.meta.json`);

    // Check if already processed (cache hit) - skip if forceDownload
    if (!forceDownload) {
      try {
        const existing = await fs.readFile(metaPath, 'utf-8');
        const meta = JSON.parse(existing) as ImageMeta;
        if (meta.src) {
          console.log(`[SyncImage] Cache hit: ${id}`);
          return meta;
        }
      } catch {
        /* Cache miss - continue to process */
      }
    } else {
      console.log(`[SyncImage] Force download: ${id}`);
    }

    console.log(`[SyncImage] Processing: ${id} (${fileId})`);

    // Create directory
    await fs.mkdir(baseDir, { recursive: true });

    // Fetch image from WordPress
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Astro-Sync/1.0' },
    });

    if (!response.ok) {
      console.error(`[SyncImage] Failed to fetch: ${url} (${response.status})`);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Handle SVG
    if (isSvg) {
      const { optimize } = await import('svgo');
      const result = optimize(buffer.toString('utf-8'), { multipass: true });
      const outPath = path.join(baseDir, `${fileId}.svg`);
      const webPath = `/wp-content/uploads/${pathInfo.dir.replace(/\\/g, '/')}/${fileId}.svg`;

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

      await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
      return meta;
    }

    // Handle bitmap images
    const image = sharp(buffer);
    const metadata = await image.metadata();
    const width = metadata.width || 1200;
    const height = metadata.height || 600;

    // Generate LQIP (Low Quality Image Placeholder)
    const lqipBuffer = await image
      .clone()
      .resize(4, Math.round(4 * (height / width)), { fit: 'cover' })
      .toFormat('png')
      .toBuffer();
    const lqip = `data:image/png;base64,${lqipBuffer.toString('base64')}`;

    // Generate optimized variants
    const sources: Record<string, string[]> = { webp: [], avif: [] };
    let largestSrc = '';

    for (const fmt of IMAGE_FORMATS) {
      for (const w of IMAGE_SIZES) {
        // Skip sizes larger than original (except largest)
        if (w > width && w !== IMAGE_SIZES[IMAGE_SIZES.length - 1]) continue;

        const fileName = `${fileId}-${w}w.${fmt}`;
        const outPath = path.join(baseDir, fileName);
        const webPath = `/wp-content/uploads/${pathInfo.dir.replace(/\\/g, '/')}/${fileName}`;

        // Check if this variant already exists
        try {
          await fs.access(outPath);
          // File exists, skip generation
        } catch {
          // Generate this variant
          await image
            .clone()
            .resize(w, null, { fit: 'inside', withoutEnlargement: true })
            .toFormat(fmt, { quality: fmt === 'avif' ? 65 : 80 })
            .toFile(outPath);
        }

        largestSrc = webPath;
        sources[fmt].push(`${webPath} ${w}w`);
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

    // Save meta.json
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
    console.log(`[SyncImage] ✓ Optimized: ${id}`);

    return meta;
  } catch (error) {
    console.error(`[SyncImage] Error processing ${id}:`, error);
    return null;
  }
}

/**
 * Batch sync multiple images with concurrency control
 */
export async function syncImagesBatch(
  images: Array<{ id: number; url: string; alt?: string }>,
  concurrency: number = 3
): Promise<Map<number, ImageMeta>> {
  const results = new Map<number, ImageMeta>();

  // Process in batches
  for (let i = 0; i < images.length; i += concurrency) {
    const batch = images.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      batch.map(async (img) => {
        const result = await syncImage(img.id, img.url, img.alt || '');
        return { id: img.id, result };
      })
    );

    for (const { id, result } of batchResults) {
      if (result) {
        results.set(id, result);
      }
    }
  }

  return results;
}
