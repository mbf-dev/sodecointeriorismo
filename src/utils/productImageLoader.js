// Utility to fetch product thumbnail if missing in index
export async function fetchProductImage(slug, id) {
  try {
    const res = await fetch(`/src/data/wp/products/${id}.json`);
    if (!res.ok) throw new Error('Product not found');
    const data = await res.json();

    // Helper: Extract smallest WebP from an optimized object
    const extractSmallest = (opt) => {
      if (opt?.sources) {
        const webp = opt.sources.find((s) => s.type === 'image/webp');
        if (webp?.srcset) {
          // "path/to/img-320w.webp 320w, path/to/img-640w.webp 640w"
          return webp.srcset.split(',')[0].trim().split(' ')[0];
        }
      }
      return opt?.src;
    };

    // 1. Check for direct optimized object (from updated sync)
    const directOptimized = data.image?.optimized || data.images?.[0]?.optimized;
    if (directOptimized) {
      const url = extractSmallest(directOptimized);
      if (url) return url;
    }

    // 2. Resolve Candidate Payload (could be URL string or ID number)
    let candidate = data.image || data.images?.[0]?.src || data.images?.[0];
    let imageId = null;

    if (!candidate) return null;

    // 3. ID Resolution
    if (typeof candidate === 'number') {
      imageId = candidate; // Track ID for later use
      try {
        // A. Check local media store created by process-images script
        const localMediaRes = await fetch(`/src/data/wp/media/${candidate}.json`);
        if (localMediaRes.ok) {
          const meta = await localMediaRes.json();
          const url = extractSmallest(meta);
          if (url) return url;
        }

        // B. Fetch media info from public WP API (Fallback)
        const mediaRes = await fetch(
          `https://wpadmin.buildmaster.dev/wp-json/wp/v2/media/${candidate}`
        );
        if (mediaRes.ok) {
          const mediaJson = await mediaRes.json();
          candidate = mediaJson.source_url;
        } else {
          return null;
        }
      } catch (e) {
        return null;
      }
    }

    // 4. Local Meta Lookup
    // Now candidate is strictly a URL (local string or absolute remote string)
    if (typeof candidate === 'string') {
      let relativePath = candidate;
      try {
        if (candidate.startsWith('http')) {
          const urlObj = new URL(candidate);
          relativePath = urlObj.pathname;
        }
      } catch (e) {}

      if (relativePath.includes('/wp-content/uploads/')) {
        // Priority: Try [ImageID].json if we know the ID (from step 3)
        if (imageId) {
          const baseDir = relativePath.substring(0, relativePath.lastIndexOf('/') + 1);
          const idMetaPath = `${baseDir}${imageId}.json`;
          try {
            const metaRes = await fetch(idMetaPath);
            if (metaRes.ok) {
              const meta = await metaRes.json();
              const url = extractSmallest(meta);
              if (url) return url;
            }
          } catch (e) {}
        }

        // Fallback: Try Name-based meta (.meta.json)
        const metaPath = relativePath.replace(/\.[^/.]+$/, '.meta.json');
        try {
          const metaRes = await fetch(metaPath);
          if (metaRes.ok) {
            const meta = await metaRes.json();
            const url = extractSmallest(meta);
            if (url) return url;
          }
        } catch (e) {
          // Meta fetch failed
        }

        return candidate;
      }
    }

    return candidate;
  } catch (e) {
    return null;
  }
}
