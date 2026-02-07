<script>
  import { onMount, onDestroy } from 'svelte';

  let { 
    slides = [], 
    height = 'h-screen', 
    autoplay = true,
    paddingTop = 0,
    paddingBottom = 0,
    marginTop = 0,
    marginBottom = 0
  } = $props();

  let activeIndex = $state(0);
  let timer;

  const nextSlide = () => {
    activeIndex = (activeIndex + 1) % slides.length;
  };

  const prevSlide = () => {
    activeIndex = (activeIndex - 1 + slides.length) % slides.length;
  };

  const goToSlide = (index) => {
    activeIndex = index;
  };

  // Autoplay Logic
  onMount(() => {
    if (autoplay && slides.length > 1) {
      timer = setInterval(nextSlide, 5000);
    }
  });

  onDestroy(() => {
    if (timer) clearInterval(timer);
  });

  // --- Constants ---
  const TW_VALUES = {
      0: { m: '0', t: '0', d: '0' },
      1: { m: '4', t: '4', d: '4' },
      2: { m: '8', t: '8', d: '8' },
      3: { m: '12', t: '12', d: '12' },
      4: { m: '16', t: '16', d: '16' },
      5: { m: '20', t: '20', d: '20' },
      6: { m: '24', t: '24', d: '24' },
      7: { m: '28', t: '28', d: '28' },
      8: { m: '32', t: '32', d: '32' },
      9: { m: '36', t: '36', d: '36' },
      10: { m: '40', t: '40', d: '40' }
  };
  
  const CLASS_LOOKUP = {
      pt: {
          0: 'pt-0', 4: 'pt-4', 8: 'pt-8', 12: 'pt-12', 16: 'pt-16', 20: 'pt-20', 24: 'pt-24', 28: 'pt-28', 32: 'pt-32', 36: 'pt-36', 40: 'pt-40',
          md0: 'md:pt-0', md4: 'md:pt-4', md8: 'md:pt-8', md12: 'md:pt-12', md16: 'md:pt-16', md20: 'md:pt-20', md24: 'md:pt-24', md28: 'md:pt-28', md32: 'md:pt-32', md36: 'md:pt-36', md40: 'md:pt-40',
          lg0: 'lg:pt-0', lg4: 'lg:pt-4', lg8: 'lg:pt-8', lg12: 'lg:pt-12', lg16: 'lg:pt-16', lg20: 'lg:pt-20', lg24: 'lg:pt-24', lg28: 'lg:pt-28', lg32: 'lg:pt-32', lg36: 'lg:pt-36', lg40: 'lg:pt-40',
      },
      pb: {
          0: 'pb-0', 4: 'pb-4', 8: 'pb-8', 12: 'pb-12', 16: 'pb-16', 20: 'pb-20', 24: 'pb-24', 28: 'pb-28', 32: 'pb-32', 36: 'pb-36', 40: 'pb-40',
          md0: 'md:pb-0', md4: 'md:pb-4', md8: 'md:pb-8', md12: 'md:pb-12', md16: 'md:pb-16', md20: 'md:pb-20', md24: 'md:pb-24', md28: 'md:pb-28', md32: 'md:pb-32', md36: 'md:pb-36', md40: 'md:pb-40',
          lg0: 'lg:pb-0', lg4: 'lg:pb-4', lg8: 'lg:pb-8', lg12: 'lg:pb-12', lg16: 'lg:pb-16', lg20: 'lg:pb-20', lg24: 'lg:pb-24', lg28: 'lg:pb-28', lg32: 'lg:pb-32', lg36: 'lg:pb-36', lg40: 'lg:pb-40',
      },
      mt: {
          0: 'mt-0', 4: 'mt-4', 8: 'mt-8', 12: 'mt-12', 16: 'mt-16', 20: 'mt-20', 24: 'mt-24', 28: 'mt-28', 32: 'mt-32', 36: 'mt-36', 40: 'mt-40',
          md0: 'md:mt-0', md4: 'md:mt-4', md8: 'md:mt-8', md12: 'md:mt-12', md16: 'md:mt-16', md20: 'md:mt-20', md24: 'md:mt-24', md28: 'md:mt-28', md32: 'md:mt-32', md36: 'md:mt-36', md40: 'md:mt-40',
          lg0: 'lg:mt-0', lg4: 'lg:mt-4', lg8: 'lg:mt-8', lg12: 'lg:mt-12', lg16: 'lg:mt-16', lg20: 'lg:mt-20', lg24: 'lg:mt-24', lg28: 'lg:mt-28', lg32: 'lg:mt-32', lg36: 'lg:mt-36', lg40: 'lg:mt-40',
      },
      mb: {
          0: 'mb-0', 4: 'mb-4', 8: 'mb-8', 12: 'mb-12', 16: 'mb-16', 20: 'mb-20', 24: 'mb-24', 28: 'mb-28', 32: 'mb-32', 36: 'mb-36', 40: 'mb-40',
          md0: 'md:mb-0', md4: 'md:mb-4', md8: 'md:mb-8', md12: 'md:mb-12', md16: 'md:mb-16', md20: 'md:mb-20', md24: 'md:mb-24', md28: 'md:mb-28', md32: 'md:mb-32', md36: 'md:mb-36', md40: 'md:mb-40',
          lg0: 'lg:mb-0', lg4: 'lg:mb-4', lg8: 'lg:mb-8', lg12: 'lg:mb-12', lg16: 'lg:mb-16', lg20: 'lg:mb-20', lg24: 'lg:mb-24', lg28: 'lg:mb-28', lg32: 'lg:mb-32', lg36: 'lg:mb-36', lg40: 'lg:mb-40',
      }
  };

  const getResponsiveClass = (values, prefix) => {
    let vM = '0';
    let vT = '0';
    let vD = '0';

    if (typeof values !== 'object' || values === null) {
        vD = TW_VALUES[values || 0]?.d || '0';
        vT = '0';
        vM = '0';
    } else {
        vM = TW_VALUES[values.mobile || 0]?.m || '0';
        vT = TW_VALUES[values.tablet || 0]?.t || '0';
        vD = TW_VALUES[values.desktop || 0]?.d || '0';
    }

    const cM = CLASS_LOOKUP[prefix][vM] || `${prefix}-0`;
    const cT = CLASS_LOOKUP[prefix][`md${vT}`] || `md:${prefix}-0`;
    const cD = CLASS_LOOKUP[prefix][`lg${vD}`] || `lg:${prefix}-0`;
    
    return `${cM} ${cT} ${cD}`;
  };

  // Height Resolution
  const resolveHeightValue = (twClass) => {
    const map = {
      "h-screen": "100vh",
      "h-[75vh]": "75vh",
      "h-[50vh]": "50vh",
      "h-auto": "auto",
    };
    return map[twClass] || "100vh";
  };

  let heightValues = $derived(
      typeof height === "object" && height !== null 
      ? height 
      : { mobile: height || "h-screen", tablet: height || "h-screen", desktop: height || "h-screen" }
  );

  let hMobile = $derived(resolveHeightValue(heightValues.mobile || "h-auto"));
  let hTablet = $derived(resolveHeightValue(heightValues.tablet || "h-auto"));
  let hDesktop = $derived(resolveHeightValue(heightValues.desktop || "h-screen"));

  // Padding Logic
  const filterPadding = (paddingValues) => {
    const p = { ...(paddingValues || { mobile: 0, tablet: 0, desktop: 0 }) };
    if (heightValues.mobile !== "h-auto") p.mobile = 0;
    if (heightValues.tablet !== "h-auto") p.tablet = 0;
    if (heightValues.desktop !== "h-auto") p.desktop = 0;
    return p;
  };

  let ptClass = $derived(getResponsiveClass(filterPadding(paddingTop), 'pt'));
  let pbClass = $derived(getResponsiveClass(filterPadding(paddingBottom), 'pb'));
  let mtClass = $derived(getResponsiveClass(marginTop, 'mt'));
  let mbClass = $derived(getResponsiveClass(marginBottom, 'mb'));

</script>

<div 
  class={`container ${mtClass} ${mbClass}`}
  style={`--h-mobile: ${hMobile}; --h-tablet: ${hTablet}; --h-desktop: ${hDesktop};`}
>
  <div class="carousel w-full relative overflow-hidden group rounded-xl">
     <!-- Contenedor interno -->
    <div class={`w-full h-full grid grid-cols-1 grid-rows-1 group ${ptClass} ${pbClass}`}>

    {#each slides as slide, index (index)}
        <!-- Slide -->
        <div
        class={`col-start-1 row-start-1 w-full h-full transition-opacity duration-700 ease-in-out
            ${index === activeIndex ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}
        `}
        >
        <!-- Background Image -->
        <div class="absolute inset-0 z-0">
            {#if slide.image}
                <img
                src={slide.image.url}
                alt={slide.image.alt || slide.title}
                class="w-full h-full object-cover"
                />
            {:else}
                <div class="w-full h-full bg-neutral text-neutral-content flex items-center justify-center">
                <span class="text-xl opacity-50">No Image</span>
                </div>
            {/if}
            <div class="hidden absolute inset-0 bg-black/40 pointer-events-none"></div>
        </div>

        <!-- Content -->
        <div class="relative w-full md:w-fit h-full max-w-4xl flex flex-col items-center md:items-start justify-center md:text-start text-center px-8 py-6 z-20 glass shadow-none md:rounded-r-xl">
            {#if slide.subtitle}
            <p class="text-white text-lg uppercase tracking-widest font-semibold mb-4 animate-fade-in-up">
                {slide.subtitle}
            </p>
            {/if}

            {#if slide.title}
            <h1 class="text-white text-shadow-md text-5xl md:text-6xl font-bold leading-tight mb-6 max-w-4xl">
                {@html slide.title}
            </h1>
            {/if}

            {#if slide.description}
            <div class="text-gray-200 text-lg md:text-xl mb-8 max-w-2xl">
                {@html slide.description}
            </div>
            {/if}

            {#if slide.buttons && slide.buttons.length > 0}
            <div class="flex flex-wrap gap-4 justify-center">
                {#each slide.buttons as btn}
                <a href={btn.url} class={`btn ${btn.variant} btn-lg`}>
                    {btn.text}
                </a>
                {/each}
            </div>
            {/if}
        </div>
        </div>
    {/each}

    <!-- Navigation Arrows -->
    {#if slides.length > 1}
        <!-- Indicators -->
        <div class="absolute bottom-1.5 w-fit flex items-center right-1.5 px-4 py-2 glass gap-2 z-30 pointer-events-auto rounded-l-4xl rounded-br-xl rounded-tr-xl">
            {#each slides as _, idx}
                <button 
                    class={`h-2 rounded-full transition-all cursor-pointer pointer-events-auto ${idx === activeIndex ? 'w-8 bg-neutral' : 'w-2 bg-neutral/50'}`}
                    onclick={() => goToSlide(idx)}
                    aria-label={`Go to slide ${idx + 1}`}
                ></button>
            {/each}
            <button class="btn btn-sm btn-secondary btn-circle pointer-events-auto shadow-none" onclick={prevSlide} aria-label="Previous Slide">
              <span class="icon-[heroicons--chevron-left-20-solid] size-6"></span>
          </button>
          <button class="btn btn-sm btn-secondary btn-circle pointer-events-auto shadow-none" onclick={nextSlide} aria-label="Next Slide">
              <span class="icon-[heroicons--chevron-right-20-solid] size-6"></span>
          </button>
        </div>
    {/if}

    </div>
  </div>
</div>

<style>
    /* basic fade helper */
    .carousel-item {
        display: block !important;
    }

    @keyframes fadeInUp {
        from { opacity: 0; transform: translate3d(0, 40px, 0); }
        to { opacity: 1; transform: translate3d(0, 0, 0); }
    }

    .animate-fade-in-up {
        animation-duration: 0.8s;
        animation-fill-mode: both;
        animation-name: fadeInUp;
    }

    /* Responsive Height via CSS Variables */
    .carousel {
        height: var(--h-mobile, 100vh);
    }
    @media (min-width: 768px) {
        .carousel {
            height: var(--h-tablet, var(--h-mobile, 100vh));
        }
    }
    @media (min-width: 1024px) {
        .carousel {
            height: var(--h-desktop, var(--h-tablet, 100vh));
        }
    }
</style>
