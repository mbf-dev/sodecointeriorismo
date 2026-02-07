import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { IMAGE_CONFIG } from '../config/images';

// Tipos básicos para el Sync
export interface SyncPayload {
  type:
    | 'page'
    | 'post'
    | 'category'
    | 'tag'
    | 'settings'
    | 'menus'
    | 'menu'
    | 'product'
    | 'product_category'
    | 'product_tag';
  slug: string;
  data: any;
}

export interface OptimizedImage {
  src: string; // Fallback
  lqip: string; // Base64 tiny placeholder
  sources: {
    type: string;
    srcset: string;
  }[];
  width: number;
  height: number;
}

const DATA_DIR = path.join(process.cwd(), 'src/data/wp');
const ROUTES_MAP_FILE = path.join(DATA_DIR, 'routes.json');
const PUBLIC_IMG_DIR = path.join(process.cwd(), 'public/wp-content/uploads');

/**
 * Gestiona el mapeo de Slugs -> IDs para routing rápido.
 * Lee routes.json, actualiza la entrada y guarda.
 */
async function updateSlugMap(type: string, slug: string, id: number) {
  try {
    let routes: Record<string, any> = {};
    try {
      const content = await fs.readFile(ROUTES_MAP_FILE, 'utf-8');
      routes = JSON.parse(content);
    } catch {
      // Si no existe, lo creamos
    }

    // Estructura: routes[type][slug] = id;
    if (!routes[type]) routes[type] = {};

    // Limpiamos referencias viejas a este ID (si cambió el slug)
    // Esto es O(N) en el mapa de slugs del tipo, pero es rápido para unos miles.
    Object.keys(routes[type]).forEach((existingSlug) => {
      if (routes[type][existingSlug] === id && existingSlug !== slug) {
        delete routes[type][existingSlug]; // Borrar slug antiguo
        console.log(`[Sync] Remapped slug: ${existingSlug} -> ${slug} (ID: ${id})`);
      }
    });

    // Asignar nuevo
    routes[type][slug] = id;

    await fs.writeFile(ROUTES_MAP_FILE, JSON.stringify(routes, null, 2), 'utf-8');
  } catch (error) {
    console.error('[Sync] Error updating routes map:', error);
  }
}

/**
 * Guarda el JSON del contenido usando el ID como nombre de archivo.
 * También actualiza el mapa de slugs.
 * OPTIMIZADO: No procesa imágenes - eso se hace en build time.
 */
export async function saveContentJson(type: string, slug: string, data: any) {
  // CASO ESPECIAL: Settings Globales
  if (type === 'settings') {
    const settingsPath = path.join(DATA_DIR, 'site-settings.json');
    await fs.writeFile(settingsPath, JSON.stringify(data, null, 2), 'utf-8');
    return;
  }

  // CASO ESPECIAL: Menus Globales
  if (type === 'menus' || type === 'menu') {
    const menusPath = path.join(DATA_DIR, 'menus.json');

    // Si es menu individual, merge con existente
    if (type === 'menu') {
      let existingMenus: Record<string, any> = {};
      try {
        const content = await fs.readFile(menusPath, 'utf-8');
        existingMenus = JSON.parse(content);
      } catch {
        /* No existe */
      }
      existingMenus[slug] = data;
      await fs.writeFile(menusPath, JSON.stringify(existingMenus, null, 2), 'utf-8');
    } else {
      await fs.writeFile(menusPath, JSON.stringify(data, null, 2), 'utf-8');
    }
    return;
  }

  if (!data.id) {
    console.error('[Sync] Error: Content has no ID', type, slug);
    return;
  }

  // Determine proper plural
  let pluralType = `${type}s`;
  if (type === 'category') pluralType = 'categories';
  if (type === 'product_category') pluralType = 'product-categories';
  if (type === 'product_tag') pluralType = 'product-tags';

  // Guardar archivo ID.json
  const dir = path.join(DATA_DIR, pluralType);
  await fs.mkdir(dir, { recursive: true });

  const filePath = path.join(dir, `${data.id}.json`);

  // Handle Deletion
  if (data.deleted) {
    try {
      await fs.unlink(filePath);
      console.log(`[Sync] Deleted ${type} (ID: ${data.id})`);
    } catch {
      // Already gone
    }
    return;
  }

  // Inject slug
  data.slug = slug;

  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');

  // Actualizar Mapa de Rutas
  await updateSlugMap(pluralType, slug, data.id);

  // Trigger Search Index Update if Product
  if (type === 'product' && !data.deleted) {
    try {
      const { main: generateSearchIndex } = await import('../../scripts/generate-search-index.js');
      await generateSearchIndex();
      console.log('[Sync] Search index regenerated');
    } catch (err) {
      console.error('[Sync] Error regenerating search index:', err);
    }
  }
}

/**
 * Descarga una imagen de WP, genera variantes usando CONFIG y devuelve objeto optimizado.
 * Mejoras: Soporte transparencia, fit inside, config centralizada.
 */
// ... (imports)
import { optimize } from 'svgo';

// ...

export async function smartSyncImage(remoteUrl: string): Promise<OptimizedImage | null> {
  if (!remoteUrl) return null;

  try {
    const urlObj = new URL(remoteUrl);
    const match = urlObj.pathname.match(/uploads\/(.+)$/);
    if (!match) return null;

    const relativePathInfo = path.parse(match[1]);
    const fileBaseName = relativePathInfo.name.replace(/\.(jpg|jpeg|png|webp|avif)$/i, '');
    const fileId = fileBaseName;
    const isSvg = relativePathInfo.ext.toLowerCase() === '.svg';

    const baseDir = path.join(PUBLIC_IMG_DIR, relativePathInfo.dir);
    await fs.mkdir(baseDir, { recursive: true });

    const metaPath = path.join(baseDir, `${fileId}.meta.json`);

    // 1. INTENTO DE CACHÉ
    try {
      const metaContent = await fs.readFile(metaPath, 'utf-8');
      const metaJson = JSON.parse(metaContent);
      if (metaJson.src) {
        if (!isSvg && metaJson.lqip) {
          console.log(`[Sync] Cache hit (meta): ${fileId}`);
          return metaJson as OptimizedImage;
        }
        // Cacheo de SVG: solo necesitamos src
        if (isSvg) {
          console.log(`[Sync] Cache hit (SVG): ${fileId}`);
          return metaJson as OptimizedImage;
        }
      }
    } catch {
      /* Cache Miss */
    }

    // 2. GENERACIÓN (Cache Miss)
    console.log(`[Sync] Processing New Image: ${fileId} (SVG: ${isSvg})`);

    // Fetch con bypass SSL
    const agent = new (await import('https')).Agent({ rejectUnauthorized: false });
    const response = await fetch(remoteUrl, { agent } as any);

    if (!response.ok) throw new Error(`Failed to fetch ${remoteUrl}`);
    const arrayBuffer = await response.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // --- MANEJO DE SVG ---
    if (isSvg) {
      const svgString = inputBuffer.toString('utf-8');
      // Optimizar con SVGO
      const result = optimize(svgString, {
        path: remoteUrl,
        multipass: true,
        plugins: [
          'preset-default',
          'removeDimensions',
          {
            name: 'removeAttrs',
            params: { attrs: '(data-.*)' },
          },
        ],
      });

      const optimizedSvg = result.data;
      // filename override: original name or id? use original basename + .svg
      const fileName = `${relativePathInfo.name}.svg`;
      const outPath = path.join(baseDir, fileName);
      const webPath = `/wp-content/uploads/${relativePathInfo.dir.replace(/\\/g, '/')}/${fileName}`;

      await fs.writeFile(outPath, optimizedSvg, 'utf-8');

      // Metadata simple para SVG
      const finalMeta: OptimizedImage = {
        src: webPath,
        width: 0,
        height: 0,
        lqip: '',
        sources: [],
      };

      await fs.writeFile(metaPath, JSON.stringify(finalMeta, null, 2), 'utf-8');
      return finalMeta;
    }

    // --- MANEJO DE BITMAP (JPG, PNG, WEBP) ---
    const image = sharp(inputBuffer);
    const metadata = await image.metadata();
    const width = metadata.width || 1200;
    const height = metadata.height || 600;

    // LQIP
    const lqipBuffer = await image
      .clone()
      .resize(IMAGE_CONFIG.lqip.size, Math.round(IMAGE_CONFIG.lqip.size * (height / width)), {
        fit: 'cover',
      })
      .toFormat('png')
      .toBuffer();
    const lqipBase64 = `data:image/png;base64,${lqipBuffer.toString('base64')}`;

    // Tamaños y Formatos
    const sourcesData: { [key: string]: string[] } = { webp: [], avif: [] };
    const backgroundTasks = [];
    let largestSrc = '';

    for (const fmt of IMAGE_CONFIG.formats) {
      for (const w of IMAGE_CONFIG.sizes) {
        if (w > width && w !== 1600 && w !== IMAGE_CONFIG.sizes[IMAGE_CONFIG.sizes.length - 1])
          continue;

        const fileName = `${fileId}-${w}w.${fmt}`;
        const outPath = path.join(baseDir, fileName);
        const webPath = `/wp-content/uploads/${relativePathInfo.dir.replace(/\\/g, '/')}/${fileName}`;

        largestSrc = webPath;
        sourcesData[fmt].push(`${webPath} ${w}w`);

        backgroundTasks.push(
          (async () => {
            try {
              await fs.access(outPath);
            } catch {
              const options = IMAGE_CONFIG.quality[fmt as 'webp' | 'avif'];
              await image
                .clone()
                .resize(w, null, {
                  fit: IMAGE_CONFIG.resize.fit as any,
                  withoutEnlargement: IMAGE_CONFIG.resize.withoutEnlargement,
                })
                .toFormat(fmt as any, options)
                .toFile(outPath)
                .catch((err) => console.error(`[BG] Failed ${fileName}`, err));
            }
          })()
        );
      }
    }

    Promise.all(backgroundTasks).then(() => {
      const finalMeta: OptimizedImage = {
        src: largestSrc || remoteUrl,
        width,
        height,
        lqip: lqipBase64,
        sources: [
          { type: 'image/avif', srcset: sourcesData['avif'].join(', ') },
          { type: 'image/webp', srcset: sourcesData['webp'].join(', ') },
        ],
      };
      fs.writeFile(metaPath, JSON.stringify(finalMeta, null, 2), 'utf-8').catch((e) =>
        console.error(e)
      );
    });

    return {
      src: largestSrc || remoteUrl,
      width,
      height,
      lqip: lqipBase64,
      sources: [
        { type: 'image/avif', srcset: sourcesData['avif'].join(', ') },
        { type: 'image/webp', srcset: sourcesData['webp'].join(', ') },
      ],
    };
  } catch (error) {
    console.error(`[Sync] Error optimizing image ${remoteUrl}:`, error);
    return null;
  }
}

/**
 * Recursively traverse a payload to find and sync images.
 * Replaces remote URLs with local paths and adds 'optimized' data for 'url' fields.
 */
export async function deepSyncImages(obj: any): Promise<any> {
  if (Array.isArray(obj)) {
    await Promise.all(
      obj.map(async (item, index) => {
        obj[index] = await deepSyncImages(item);
      })
    );
    return obj;
  }

  if (obj && typeof obj === 'object') {
    for (const key in obj) {
      const val = obj[key];

      if (
        typeof val === 'string' &&
        val.startsWith('http') &&
        val.includes('/wp-content/uploads/')
      ) {
        // Found a candidate Image URL
        // console.log(`[Sync] Deep Sync traversing: found image at key '${key}'`);
        const optimized = await smartSyncImage(val);

        if (optimized) {
          // 1. Replace the string with the local path
          obj[key] = optimized.src;

          // 2. If the key was specific (like 'url' or 'src' or 'image'), inject the full optimized object nearby
          if (key === 'url' || key === 'src' || key === 'image') {
            obj['optimized'] = optimized;
          }
        }
      } else if (typeof val === 'object') {
        obj[key] = await deepSyncImages(val);
      }
    }
  }
  return obj;
}
