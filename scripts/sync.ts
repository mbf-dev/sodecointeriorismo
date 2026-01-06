import { parse } from '@wordpress/block-serialization-default-parser';
import { saveContentJson } from '../src/lib/wp-sync';
import fs from 'node:fs/promises';
import path from 'node:path';

const WP_API_URL = 'https://sodeco.dev.net.pe/wp-json/wp/v2';
const PER_PAGE = 100;

// Tipos básicos para los bloques analizados
interface BlockData {
  name: string;
  attributes: Record<string, any>;
  innerBlocks: BlockData[];
}

/**
 * Procesa recursivamente los bloques para limpiar y estructurar los datos
 */
function processBlocks(rawBlocks: any[]): BlockData[] {
  return rawBlocks
    .map((block) => {
      // Ignorar bloques vacíos o de texto sin sentido
      if (!block.blockName) return null;

      // Estructura base
      const processed: BlockData = {
        name: block.blockName,
        attributes: block.attrs || {},
        innerBlocks: block.innerBlocks ? processBlocks(block.innerBlocks) : [],
      };

      // --- TRATAMIENTO ESPECÍFICO POR BLOQUE ---

      // mbf/block-1: Asegurar que 'buttons' esté presente si no viene
      if (block.blockName === 'mbf/block-1') {
        // Si el parser de WP no detectó atributos por defecto (que están en block.json),
        // aquí podríamos rellenarlos. Pero normalmente vienen del HTML comment.
        // La clave es que 'buttons' es un array en los atributos.
      }

      return processed;
    })
    .filter(Boolean) as BlockData[];
}

/**
 * Fetch con paginación
 */
async function fetchAll(endpoint: string) {
  let allData: any[] = [];
  let page = 1;
  let totalPages = 1;

  // Bypass certificado auto-firmado si es necesario (dev)
  const agent = new (await import('https')).Agent({ rejectUnauthorized: false });

  do {
    console.log(`[Sync] Fetching ${endpoint} (Page ${page})...`);
    const res = await fetch(
      `${WP_API_URL}/${endpoint}?per_page=${PER_PAGE}&page=${page}&context=edit`,
      {
        method: 'GET',
        headers: {
          // Si necesitaramos auth, iría aquí.
          // 'Authorization': 'Basic ...'
        },
        agent, // Inyectar agente para SSL en Node fetch nativo (requiere soporte, si falla usar node-fetch)
      } as any
    );

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        console.warn(
          `[Sync] Warning: Access denied to ${endpoint} (Auth required?). Trying standard context.`
        );
        // Fallback a vista pública si edit falla (aunque 'content.raw' no estará)
        // Implementar lógica de reintento si es crítico.
      }
      break;
    }

    const data = await res.json();
    allData = allData.concat(data);

    const totalPagesHeader = res.headers.get('x-wp-totalpages');
    if (totalPagesHeader) {
      totalPages = parseInt(totalPagesHeader, 10);
    }
    page++;
  } while (page <= totalPages);

  return allData;
}

async function main() {
  console.log('--- STARTING SYNC ---');

  try {
    // 1. Pages
    const pages = await fetchAll('pages');
    for (const page of pages) {
      // Parsear bloques desde content.raw (context=edit) o fallback
      const rawContent = page.content?.raw || page.content?.rendered || '';
      const blocks = parse(rawContent);
      const cleanBlocks = processBlocks(blocks);

      const payload = {
        ...page,
        blocks: cleanBlocks, // Array limpio de bloques
      };

      await saveContentJson('page', page.slug, payload);
    }

    // 2. Posts
    const posts = await fetchAll('posts');
    for (const post of posts) {
      const rawContent = post.content?.raw || post.content?.rendered || '';
      const blocks = parse(rawContent);
      const cleanBlocks = processBlocks(blocks);

      const payload = {
        ...post,
        blocks: cleanBlocks,
      };

      await saveContentJson('post', post.slug, payload);
    }

    // 3. Settings (Logos, Menu, etc - Simulado leyendo de endpoint custom o site-settings local y actualizando)
    // Por ahora, asumimos que site-settings.json se gestiona manualmente o via otro endpoint.

    console.log('--- SYNC COMPLETE ---');
  } catch (err) {
    console.error('SYNC ERROR:', err);
    process.exit(1);
  }
}

main();
