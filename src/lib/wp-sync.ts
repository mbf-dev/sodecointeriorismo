import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

// Tipos básicos para el Sync
export interface SyncPayload {
  type: 'page' | 'post' | 'category' | 'tag';
  slug: string;
  data: any; // El contenido completo
}

export interface OptimizedImage {
  src: string; // Fallback (archivo local original o large jpg)
  lqip: string; // Base64 tiny placeholder
  sources: {
    type: string; // mime type
    srcset: string; // string listo para el HTML
  }[];
  width: number;
  height: number;
}

const DATA_DIR = path.join(process.cwd(), 'src/data/wp');
const PUBLIC_IMG_DIR = path.join(process.cwd(), 'public/imgs/wp-uploads');

/**
 * Guarda el JSON del contenido en la carpeta correspondiente
 */
export async function saveContentJson(type: SyncPayload['type'], slug: string, data: any) {
  const dir = path.join(DATA_DIR, `${type}s`); // pages, posts, etc.
  await fs.mkdir(dir, { recursive: true });

  const filePath = path.join(dir, `${slug}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`[Sync] Saved ${type}: ${slug}`);
}

/**
 * Descarga una imagen de WP, genera variantes (WebP/AVIF/Sizes) y devuelve objeto optimizado.
 */
export async function smartSyncImage(remoteUrl: string): Promise<OptimizedImage | null> {
  if (!remoteUrl) return null;

  try {
    const urlObj = new URL(remoteUrl);
    // Asumimos estructura wp-content/uploads/YYYY/MM/file.ext
    const match = urlObj.pathname.match(/uploads\/(.+)$/);
    if (!match) return null;

    // Estructura de carpetas: 2025/07/
    const relativePathInfo = path.parse(match[1]); // { dir: '2025/07', name: 'cusi...', ext: '.jpg' }
    const baseDir = path.join(PUBLIC_IMG_DIR, relativePathInfo.dir);

    // Crear directorio local
    await fs.mkdir(baseDir, { recursive: true });

    // Descargar imagen Master (Buffer)
    const response = await fetch(remoteUrl);
    if (!response.ok) throw new Error(`Failed to fetch ${remoteUrl}`);
    const arrayBuffer = await response.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // Inicializar Sharp
    const image = sharp(inputBuffer);
    const metadata = await image.metadata();
    const width = metadata.width || 1200;
    const height = metadata.height || 600;

    // 1. Generar Tiny LQIP (4x3px -> Base64) - Estrategia Ultra Rápida
    // Usamos png output para base64 simple o webp
    const lqipBuffer = await image
      .clone()
      .resize(4, 3, { fit: 'cover' })
      .toFormat('png')
      .toBuffer();
    const lqipBase64 = `data:image/png;base64,${lqipBuffer.toString('base64')}`;

    // 2. Definir tamaños a generar
    const sizes = [640, 1024, 1600];
    const formats = ['webp', 'avif'];

    // Generación de archivos
    // Nombre base limpio: cusi-3-1024x1024 (sin ext)
    // Pero ojo, si el nombre original ya traia dimensiones, igual lo usamos como ID.
    const fileId = relativePathInfo.name.replace(/\.jpg|\.png|\.webp|\.jpeg/gi, '');

    // Array para guardar los sources generados
    const sourcesData: { [key: string]: string[] } = {
      webp: [],
      avif: [],
    };

    // Procesar variantes en paralelo
    const tasks = [];

    for (const fmt of formats) {
      for (const w of sizes) {
        // No escalar hacia arriba
        if (w > width && w !== 1600) continue;

        const fileName = `${fileId}-${w}w.${fmt}`;
        const outPath = path.join(baseDir, fileName);
        const webPath = `/imgs/wp-uploads/${relativePathInfo.dir.replace(/\\/g, '/')}/${fileName}`;

        // Tarea de sharp
        const task = image
          .clone()
          .resize(w)
          .toFormat(fmt as any, { quality: 80 })
          .toFile(outPath)
          .then(() => {
            // Agregar a la lista de sources
            // ej: "/path/file-640w.webp 640w"
            sourcesData[fmt].push(`${webPath} ${w}w`);
          });
        tasks.push(task);
      }
    }

    // También guardar una versión "original" optimizada o usar el input si es jpg?
    // Mejor generamos un fallback jpg/webp grande standard
    const fallbackName = `${fileId}-master.jpg`;
    const fallbackPath = path.join(baseDir, fallbackName);
    const fallbackWebPath = `/imgs/wp-uploads/${relativePathInfo.dir.replace(/\\/g, '/')}/${fallbackName}`;

    tasks.push(
      image
        .clone()
        .resize({ width: 1600, withoutEnlargement: true })
        .toFormat('jpeg', { quality: 85 })
        .toFile(fallbackPath)
    );

    await Promise.all(tasks);

    console.log(`[Sync] Optimized image: ${relativePathInfo.name}`);

    // Construir objeto de retorno
    return {
      src: fallbackWebPath,
      width,
      height,
      lqip: lqipBase64,
      sources: [
        {
          type: 'image/avif',
          srcset: sourcesData['avif'].join(', '),
        },
        {
          type: 'image/webp',
          srcset: sourcesData['webp'].join(', '),
        },
      ],
    };
  } catch (error) {
    console.error(`[Sync] Error optimizing image ${remoteUrl}:`, error);
    return null;
  }
}
