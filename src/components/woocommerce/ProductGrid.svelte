<script lang="ts">
  import { onMount } from 'svelte';
  
  // Props
  interface Props {
    categoryId: number;
    initialProducts: any[];
    totalCount: number;
    perPage?: number;
  }
  
  let { categoryId, initialProducts = [], totalCount = 0, perPage = 12 }: Props = $props();
  
  // State
  let products = $state<any[]>(initialProducts);
  let loading = $state(false);
  let hasMore = $derived(products.length < totalCount);
  let page = $state(1);
  let observer: IntersectionObserver | null = null;
  let sentinel: HTMLDivElement | null = null;
  
  // Load more products
  async function loadMore() {
    if (loading || !hasMore) return;
    
    loading = true;
    page++;
    
    try {
      const res = await fetch(`/api/products?category=${categoryId}&page=${page}&per_page=${perPage}`);
      if (res.ok) {
        const newProducts = await res.json();
        products = [...products, ...newProducts];
      }
    } catch (e) {
      console.error('Error loading products:', e);
    } finally {
      loading = false;
    }
  }
  
  // Setup Intersection Observer for infinite scroll
  onMount(() => {
    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { rootMargin: '200px' }
    );
    
    if (sentinel) {
      observer.observe(sentinel);
    }
    
    return () => {
      observer?.disconnect();
    };
  });
  
  // Format price
  function formatPrice(price: string | number) {
    const num = typeof price === 'string' ? parseFloat(price) : price;
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(num);
  }
</script>

<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
  {#each products as product (product.id)}
    <a 
      href={`/product/${product.slug}`} 
      class="card bg-base-100 shadow-md hover:shadow-xl transition-all duration-300 group overflow-hidden"
    >
      <!-- Image -->
      <figure class="aspect-square overflow-hidden bg-base-200">
        {#if product.imageUrl}
          <img 
            src={product.imageUrl}
            alt={product.name}
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        {:else}
          <div class="flex items-center justify-center w-full h-full">
            <span class="icon-[heroicons--photo] size-16 opacity-20"></span>
          </div>
        {/if}
      </figure>
      
      <!-- Content -->
      <div class="card-body p-3 md:p-4">
        <h3 class="card-title text-sm md:text-base line-clamp-2 leading-tight">
          {product.name}
        </h3>
        
        <div class="mt-auto pt-2">
          {#if product.on_sale && product.regular_price}
            <div class="flex items-center gap-2">
              <span class="text-sm line-through opacity-50">
                {formatPrice(product.regular_price)}
              </span>
              <span class="text-lg font-bold text-error">
                {formatPrice(product.price)}
              </span>
            </div>
          {:else if product.price}
            <span class="text-lg font-bold text-primary">
              {formatPrice(product.price)}
            </span>
          {:else}
            <span class="text-sm opacity-50">Consultar precio</span>
          {/if}
        </div>
      </div>
    </a>
  {/each}
</div>

<!-- Loading indicator -->
{#if loading}
  <div class="flex justify-center py-8">
    <span class="loading loading-spinner loading-lg text-primary"></span>
  </div>
{/if}

<!-- Sentinel for intersection observer -->
{#if hasMore}
  <div bind:this={sentinel} class="h-4"></div>
{/if}

<!-- No more products -->
{#if !hasMore && products.length > 0}
  <div class="text-center py-8 opacity-50">
    <p>Has visto todos los productos</p>
  </div>
{/if}

<!-- Empty state -->
{#if products.length === 0 && !loading}
  <div class="col-span-full text-center py-20 bg-base-200/50 rounded-box">
    <span class="icon-[heroicons--shopping-bag] size-12 opacity-20 mb-4 block mx-auto"></span>
    <h3 class="text-xl font-semibold opacity-50">No hay productos</h3>
    <p class="text-sm opacity-40">Esta categoría aún no tiene productos.</p>
  </div>
{/if}
