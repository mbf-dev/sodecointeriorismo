// Searchable Product Index Generator
// Helps generate a lightweight index for fast client-side searching

import { promises as fs } from 'fs';
import path from 'path';

// Helper to load all product JSONs
async function loadAllProducts(productsDir) {
  const products = [];
  const files = await fs.readdir(productsDir);

  for (const file of files) {
    if (file.endsWith('.json')) {
      const content = await fs.readFile(path.join(productsDir, file), 'utf-8');
      try {
        const product = JSON.parse(content);
        // Keep only essential fields for search to minimize payload
        // Image Logic
        let smallImage = '';
        const opt = product.optimized || product.images?.[0]?.optimized;

        if (opt?.sources) {
          const webp = opt.sources.find((s) => s.type === 'image/webp');
          if (webp?.srcset) {
            smallImage = webp.srcset.split(',')[0].trim().split(' ')[0];
          }
        }

        products.push({
          id: product.id,
          name: product.name || '',
          slug: product.slug || '',
          sku: product.sku || '',
          price: product.price || '',
          image: smallImage || opt?.src || product.image || product.images?.[0]?.src || '',
        });
      } catch (e) {
        console.error(`Error parsing ${file}:`, e);
      }
    }
  }
  return products;
}

// Main execution
async function main() {
  // Ensure paths are correct regardless of where script is called from (root or scripts dir)
  // We assume the script is running from the project root OR we need to find the root.
  // Best practice in this repo seems to be running from root.
  const BASE_DIR = process.cwd();
  // Adjust if we are inside astro/scripts somehow (though usually npm scripts run from root)
  // But let's stick to the process.cwd() assumption which is standard for Astro/Vite projects.

  const productsDir = path.join(BASE_DIR, 'src/data/wp/products');
  const outputDir = path.join(BASE_DIR, 'src/data/wp');
  const indexFile = path.join(outputDir, 'search-index.json');

  try {
    await fs.mkdir(outputDir, { recursive: true }); // Ensure dir exists
    const products = await loadAllProducts(productsDir);
    await fs.writeFile(indexFile, JSON.stringify(products), 'utf-8');
    console.log(`Search index generated with ${products.length} products`);
  } catch (e) {
    console.error('Error generating search index:', e);
  }
}

import { pathToFileURL } from 'url';

// Execute immediately if run directly
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log('Starting search index generation...');
  main();
}

export { main };
