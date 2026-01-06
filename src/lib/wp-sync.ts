import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { IMAGE_CONFIG } from '../config/images';

// Tipos básicos para el Sync
export interface SyncPayload {
  type: 'page' | 'post' | 'category' | 'tag' | 'settings';
  slug: string; // El slug actual que viene del webhook
  data: any; // El contenido completo (incluye ID)
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
 */
export async function saveContentJson(type: SyncPayload['type'], slug: string, data: any) {
  // CASO ESPECIAL: Settings Globales (Home/Blog ID)
  if (type === 'settings') {
    // Procesar logos si existen
    if (data.logos) {
      for (const [key, logoData] of Object.entries(data.logos)) {
        // logoData es { id, url, mime } gracias al PHP actualizado
        if (logoData && (logoData as any).url) {
          console.log(`[Sync] Optimizing Settings Logo: ${key}`);
          const optimized = await smartSyncImage((logoData as any).url);
          if (optimized) {
            (data.logos as any)[key] = {
              ...(logoData as any),
              optimized,
            };
          }
        }
      }
    }

    const settingsPath = path.join(DATA_DIR, 'site-settings.json');
    await fs.writeFile(settingsPath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[Sync] Updated Site Settings`);
    return;
  }

  if (!data.id) {
    console.error('[Sync] Error: Content has no ID', data);
    return;
  }

  // Determine proper plural
  let pluralType = `${type}s`;
  if (type === 'category') {
    pluralType = 'categories';
  }

  // 1. Guardar archivo ID.json
  const dir = path.join(DATA_DIR, pluralType); // pages, posts, categories...
  await fs.mkdir(dir, { recursive: true });

  const filePath = path.join(dir, `${data.id}.json`);

  // Inyectar el slug en la data por seguridad
  data.slug = slug;

  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`[Sync] Saved ${type} (ID: ${data.id})`);

  // 2. Actualizar Mapa de Rutas
  await updateSlugMap(pluralType, slug, data.id);

  // 3. DEEP SYNC: Si es un POST, asegurarnos de que sus categorías y tags existan.
  if (type === 'post') {
    if (Array.isArray(data.categories)) {
      for (const cat of data.categories) {
        if (cat.id && cat.slug) {
          // Guardamos la categoría recursivamente
          // Notar que 'cat' ya tiene { name, slug, id } gracias al hook de WP
          await saveContentJson('category', cat.slug, cat);
        }
      }
    }
    if (Array.isArray(data.tags)) {
      for (const tag of data.tags) {
        if (tag.id && tag.slug) {
          await saveContentJson('tag', tag.slug, tag);
        }
      }
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
    const response = await fetch(remoteUrl, ({ agent } as any) || {});

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
