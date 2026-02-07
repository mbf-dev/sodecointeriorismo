import type { APIRoute } from 'astro';
import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'src/data/wp');
const WP_API = 'https://wpadmin.buildmaster.dev/wp-json/wp/v2';

// Cache for image URLs
const imageCache = new Map<number, string>();

export const GET: APIRoute = async ({ params, redirect }) => {
  const imageId = parseInt(params.id || '0', 10);

  if (!imageId) {
    return new Response('Invalid image ID', { status: 400 });
  }

  // Check cache
  if (imageCache.has(imageId)) {
    return redirect(imageCache.get(imageId)!, 302);
  }

  try {
    // Try to find meta.json in public folder
    const publicDir = path.join(process.cwd(), 'public/wp-content/uploads');
    const metaFiles = await findMetaFile(publicDir, imageId);

    if (metaFiles) {
      imageCache.set(imageId, metaFiles);
      return redirect(metaFiles, 302);
    }

    // Fallback: Fetch from WP API
    const response = await fetch(`${WP_API}/media/${imageId}`);
    if (response.ok) {
      const data = await response.json();
      const url = data.source_url;
      if (url) {
        imageCache.set(imageId, url);
        return redirect(url, 302);
      }
    }

    // Not found - return placeholder
    return redirect('/images/placeholder.webp', 302);
  } catch (e) {
    console.error(`Error fetching image ${imageId}:`, e);
    return redirect('/images/placeholder.webp', 302);
  }
};

async function findMetaFile(dir: string, imageId: number): Promise<string | null> {
  // This is a simplified approach - in production you'd want an index
  // For now, we check if the image was processed by looking at attachments
  // This will be improved when we build a proper media library

  // For now, just return null and rely on WP API
  // The image processing script creates meta.json files that can be indexed
  return null;
}
