import type { APIRoute } from 'astro';
import { saveContentJson, smartSyncImage, type SyncPayload } from '../../../lib/wp-sync';

// TODO: Mover a variable de entorno
const SECRET_TOKEN = 'sodeco_secure_sync_token';

export const POST: APIRoute = async ({ request }) => {
  console.log('[Webhook] Received request');
  // 1. Seguridad básica
  const token = request.headers.get('x-sync-token');
  if (token !== SECRET_TOKEN) {
    console.error('[Webhook] Invalid token:', token);
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const payload = (await request.json()) as SyncPayload;
    console.log(`[Webhook] Processing ${payload.type}: ${payload.slug}`);
    const { type, slug, data } = payload;

    if (!type || !slug || !data) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 });
    }

    // 2. Procesar Imagen Destacada si existe (Smart Sync)
    if (data.featured_image && data.featured_image.url) {
      const localUrl = await smartSyncImage(data.featured_image.url);
      if (localUrl) {
        data.featured_image.local_url = localUrl; // Guardamos ambas por si acaso
      }
    }

    // 3. Procesar imágenes dentro del contenido (Opcional - Regex simple)
    // Aquí se podría escanear data.content buscando src="..." y descargarlas
    // Se deja para una fase 2 para no complejizar ahora.

    // 4. Guardar JSON
    await saveContentJson(type, slug, data);

    return new Response(JSON.stringify({ success: true, slug }), { status: 200 });
  } catch (error) {
    console.error('[Webhook] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
};
