import type { APIRoute } from 'astro';
import { saveContentJson, type SyncPayload } from '../../../lib/wp-sync';
import { syncImage } from '../sync-image';

const SECRET_TOKEN = 'sodeco_secure_sync_token';
const WP_API = 'https://wpadmin.buildmaster.dev/wp-json/wp/v2';

export const POST: APIRoute = async ({ request, url }) => {
  const startTime = Date.now();

  // Security check
  const token = request.headers.get('x-sync-token');
  if (token !== SECRET_TOKEN) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const payload = (await request.json()) as SyncPayload;
    const { type, slug, data } = payload;

    if (!type || !slug || !data) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 });
    }

    // Check if we should sync images (for individual syncs)
    const syncImages =
      url.searchParams.get('sync_images') === 'true' ||
      request.headers.get('x-sync-images') === 'true';

    const forceImages = request.headers.get('x-force-images') === 'true';

    // Process images for products if requested
    if (type === 'product' && syncImages) {
      await processProductImages(data, forceImages);
    }

    // Save JSON (always fast - just file write)
    await saveContentJson(type, slug, data);

    const elapsed = Date.now() - startTime;
    console.log(`[Webhook] ✓ ${type}:${slug} saved in ${elapsed}ms`);

    return new Response(JSON.stringify({ success: true, slug, elapsed }), { status: 200 });
  } catch (error) {
    console.error('[Webhook] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
};

/**
 * Process images for a product - main image and gallery
 * Uses caching - won't re-download if meta.json exists (unless forceImages is true)
 */
async function processProductImages(data: any, forceImages: boolean = false): Promise<void> {
  const imageIds: number[] = [];

  // Main image
  if (typeof data.image === 'number' && data.image > 0) {
    imageIds.push(data.image);
  }

  // Gallery images
  if (Array.isArray(data.gallery_images)) {
    for (const id of data.gallery_images) {
      if (typeof id === 'number' && id > 0) {
        imageIds.push(id);
      }
    }
  }

  if (imageIds.length === 0) return;

  console.log(
    `[Webhook] Processing ${imageIds.length} images for product ${data.id}${forceImages ? ' (FORCE)' : ''}`
  );

  // Fetch image URLs from WP API (batch)
  const imageData = await fetchImageData(imageIds);

  // Process each image (with caching - skips if exists unless forceImages)
  for (const img of imageData) {
    await syncImage(img.id, img.url, img.alt, forceImages);
  }
}

/**
 * Fetch image URLs from WordPress API
 */
async function fetchImageData(
  ids: number[]
): Promise<Array<{ id: number; url: string; alt: string }>> {
  const results: Array<{ id: number; url: string; alt: string }> = [];

  // Batch fetch - up to 100 at a time
  const batchSize = 20;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const includeParam = batch.join(',');

    try {
      const response = await fetch(`${WP_API}/media?include=${includeParam}&per_page=${batchSize}`);
      if (response.ok) {
        const mediaItems = await response.json();
        for (const item of mediaItems) {
          results.push({
            id: item.id,
            url: item.source_url,
            alt: item.alt_text || item.title?.rendered || '',
          });
        }
      }
    } catch (e) {
      console.error(`[Webhook] Failed to fetch media batch:`, e);
    }
  }

  return results;
}
