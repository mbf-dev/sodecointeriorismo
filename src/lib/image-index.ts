import fs from 'node:fs/promises';
import path from 'node:path';

const MEDIA_DIR = path.join(process.cwd(), 'src/data/wp/media');

/**
 * Get image meta by ID - FAST lookup from centralized media store
 */
export async function getImageMeta(imageId: number | string | null): Promise<any | null> {
  if (!imageId) return null;

  const id = typeof imageId === 'string' ? parseInt(imageId, 10) : imageId;
  if (isNaN(id)) return null;

  const filePath = path.join(MEDIA_DIR, `${id}.json`);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Get optimized image src by ID
 */
export async function getImageSrc(imageId: number | string | null): Promise<string | null> {
  const meta = await getImageMeta(imageId);
  if (!meta) return null;

  // Prioritize AVIF
  if (meta.sources) {
    const avif = meta.sources.find((s: any) => s.type === 'image/avif');
    if (avif?.srcset) {
      // "path/to/img-640w.avif 640w, ..."
      return avif.srcset.split(',')[0].trim().split(' ')[0];
    }
  }

  return meta.src || null;
}

// Deprecated / No-op
export async function buildImageIndex() {
  return new Map();
}
export function clearImageIndex() {}
