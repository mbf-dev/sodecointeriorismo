import fs from 'node:fs/promises';
import path from 'node:path';

// Tipos básicos para el Sync
export interface SyncPayload {
  type: 'page' | 'post' | 'category' | 'tag';
  slug: string;
  data: any; // El contenido completo
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
 * Descarga una imagen de WP y la guarda localmente preservando ruta de fecha
 * Retorna la ruta local relativa (/imgs/wp-uploads/...)
 */
export async function smartSyncImage(remoteUrl: string): Promise<string | null> {
  if (!remoteUrl) return null;

  try {
    const urlObj = new URL(remoteUrl);
    // Asumimos estructura wp-content/uploads/YYYY/MM/file.ext
    // Extraemos todo lo que venga después de 'uploads/'
    const match = urlObj.pathname.match(/uploads\/(.+)$/);

    if (!match) return remoteUrl; // No es una imagen de uploads estándar

    const relativePath = match[1]; // ej: 2026/01/hero.jpg
    const localPath = path.join(PUBLIC_IMG_DIR, relativePath);
    const localDir = path.dirname(localPath);

    // Crear directorio local
    await fs.mkdir(localDir, { recursive: true });

    // Verificar si existe y si deberíamos descargarla (simple check de existencia por ahora)
    // TODO: Mejorar con ETag/Last-Modified request HEAD si es crítico
    /* 
       Optimización: Si el archivo existe, asumimos que es el mismo 
       para máxima velocidad. WP anexa -1, -2 si cambia el archivo pero mismo nombre.
    */
    try {
      await fs.access(localPath);
      // Si existe, retornamos la ruta pública directamente
      return `/imgs/wp-uploads/${relativePath}`;
    } catch {
      // No existe, descargar
    }

    const response = await fetch(remoteUrl);
    if (!response.ok) throw new Error(`Failed to fetch ${remoteUrl}`);

    const arrayBuffer = await response.arrayBuffer();
    await fs.writeFile(localPath, Buffer.from(arrayBuffer));

    console.log(`[Sync] Image downloaded: ${relativePath}`);
    return `/imgs/wp-uploads/${relativePath}`;
  } catch (error) {
    console.error(`[Sync] Error downloading image ${remoteUrl}:`, error);
    return remoteUrl; // Fallback a remota si falla
  }
}
