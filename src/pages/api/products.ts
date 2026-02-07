import type { APIRoute } from 'astro';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getImageSrc } from '../../lib/image-index';

const DATA_DIR = path.join(process.cwd(), 'src/data/wp');

export const GET: APIRoute = async ({ url }) => {
  try {
    const categoryId = url.searchParams.get('category');
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const perPage = parseInt(url.searchParams.get('per_page') || '12', 10);

    if (!categoryId) {
      return new Response(JSON.stringify({ error: 'Missing category parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Load products of category
    const products = await getProductsByCategory(parseInt(categoryId, 10), page, perPage);

    return new Response(JSON.stringify(products), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60', // Cache 1 minute
      },
    });
  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

async function getProductsByCategory(categoryId: number, page: number, perPage: number) {
  const productsDir = path.join(DATA_DIR, 'products');
  const products: any[] = [];

  try {
    const files = await fs.readdir(productsDir);

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const content = await fs.readFile(path.join(productsDir, file), 'utf-8');
        const product = JSON.parse(content);

        // Check if product belongs to this category
        if (product.categories && product.categories.includes(categoryId)) {
          products.push(product);
        }
      } catch {
        /* Skip invalid files */
      }
    }

    // Sort by date (newest first)
    products.sort((a, b) => {
      const dateA = new Date(a.date_created || 0).getTime();
      const dateB = new Date(b.date_created || 0).getTime();
      return dateB - dateA;
    });

    // Paginate
    const start = (page - 1) * perPage;
    const paginated = products.slice(start, start + perPage);

    // Format for frontend with optimized image URLs (fast lookup via index)
    return Promise.all(
      paginated.map(async (p) => {
        const optimizedUrl = await getImageSrc(p.image);
        if (!optimizedUrl && p.image) {
          console.log(`[ProductsAPI] Missed optimized image for ID: ${p.image}`);
        }
        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: p.price,
          regular_price: p.regular_price,
          on_sale: p.on_sale,
          imageUrl: optimizedUrl || `/api/image/${p.image}`,
          categories: p.categories,
        };
      })
    );
  } catch (e) {
    console.error('Error reading products:', e);
    return [];
  }
}
