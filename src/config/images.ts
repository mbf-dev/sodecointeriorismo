export const IMAGE_CONFIG = {
  // Tamaños a generar (width)
  sizes: [640, 1024, 1600],

  // Formatos de salida
  formats: ['webp', 'avif'] as const,

  // Configuración de Calidad y Compresión
  quality: {
    webp: {
      quality: 80,
      alphaQuality: 90, // Preservar transparencia
      nearLossless: false,
      smartSubsample: true,
    },
    avif: {
      quality: 70, // AVIF es más eficiente, un valor menor da igual calidad visual
      effort: 4, // Balance entre velocidad y compresión (0-9)
    },
    jpeg: {
      quality: 80,
      mozjpeg: true,
    },
  },

  // LQIP (Low Quality Image Placeholder)
  lqip: {
    size: 4, // 4px de ancho
    blur: 10, // Píxeles de blur en CSS (referencia visual)
  },

  // Configuración de Resize
  resize: {
    fit: 'inside', // 'inside': Escala manteniendo ratio, sin cortar. Evita deformaciones.
    withoutEnlargement: true, // Nunca escalar hacia arriba (upscale)
  },
};
