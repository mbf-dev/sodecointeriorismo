<script>
    import { onMount } from 'svelte';
    import Fuse from 'fuse.js';
    import { decodeHtmlEntities } from '../../utils/formatting';
    import searchIndex from '/src/data/wp/search-index.json';
    
    // Globals
    const modules = import.meta.glob('/src/data/wp/product-categories/*.json', { eager: true });
    
    // State
    let searchValue = $state("");
    let selectedCategory = $state(null);
    let categories = $state([]);
    let searchResults = $state([]);
    let fuse;
    let modalRef; // Reference to modal element
    let hasSearched = $state(false);

    // Initialize Data
    onMount(() => {
        const allCats = Object.values(modules).map((m) => m.default || m);
        categories = allCats.filter(c => !c.parent_id || c.parent_id === 0)
                            .sort((a,b) => (a.name || '').localeCompare(b.name || ''));

        fuse = new Fuse(searchIndex, {
            keys: [{ name: 'name', weight: 0.7 }, { name: 'sku', weight: 0.3 }],
            threshold: 0.3, ignoreLocation: true
        });
    });

    // Search Logic
    function performSearch() {
        if (!searchValue.trim()) {
            searchResults = [];
            hasSearched = false;
            return;
        }

        hasSearched = true;
        let results = fuse.search(searchValue).map(res => res.item);

        if (selectedCategory) {
            results = results.filter(item => 
                item.category_ids && item.category_ids.includes(selectedCategory.id)
            );
        }
        // Limit results significantly for mobile performance, but enough to scroll
        searchResults = results.slice(0, 20); 
    }

    $effect(() => { performSearch(); });

    function openModal() {
        modalRef.showModal();
        // Focus input on open
        setTimeout(() => document.getElementById('mobile-search-input')?.focus(), 100);
    }
    
    function selectCategory(cat) {
        selectedCategory = cat;
        // Close dropdown via native element blur or daisyUI way?
        // daisyUI dropdowns close when focus lost. 
        // We just re-trigger search
        performSearch();
        document.activeElement?.blur(); // Close dropdown
    }
</script>

<!-- TRIGGER BUTTON -->
<button
  class="btn btn-ghost btn-circle bg-base-200 hover:bg-base-200 flex items-center border-0 lg:hidden"
  onclick={openModal}
>
  <span class="icon-[iconamoon--search-light] size-7"></span>
</button>

<!-- RESPONSIVE MODAL (daisyUI) -->
<dialog bind:this={modalRef} class="modal modal-bottom sm:modal-middle z-[9999]">
  <div class="modal-box p-0 h-[80vh] sm:h-auto flex flex-col bg-base-100 rounded-none">
    
    <!-- HEADER: Search Input + Close -->
    <div class="p-4 border-b border-base-200 sticky top-0 bg-base-100 z-20 flex gap-2 items-center">
         
         <!-- Search Input Group -->
         <div class="join border-primary border w-full rounded-lg h-12 bg-base-100">
            <!-- Category Filter Dropdown (Toggled by Button) -->
             <div class="dropdown join-item">
                <div tabindex="0" role="button" class="btn btn-ghost btn-sm h-full rounded-none px-2 font-normal text-xs text-base-content/70">
                    {selectedCategory ? (selectedCategory.name.length > 5 ? selectedCategory.name.substring(0,5)+'..' : selectedCategory.name) : 'Todo'}
                    <span class="icon-[iconamoon--arrow-down-2-thin] size-4"></span>
                </div>
                 <ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52 max-h-60 overflow-y-auto">
                    <li><button onclick={() => selectCategory(null)} class={!selectedCategory ? "active" : ""}>Todo</button></li>
                    {#each categories as cat}
                        <li><button onclick={() => selectCategory(cat)} class={selectedCategory?.id === cat.id ? "active" : ""}>{decodeHtmlEntities(cat.name)}</button></li>
                    {/each}
                </ul>
            </div>

            <!-- Input -->
             <input 
                id="mobile-search-input"
                type="text" 
                class="input join-item w-full h-full border-none focus:outline-none pl-2 text-base" 
                placeholder="Buscar productos..."
                bind:value={searchValue}
             />
             
             {#if searchValue}
                 <button class="join-item btn btn-ghost btn-sm h-full px-2" onclick={() => searchValue = ''}>
                     <span class="icon-[heroicons--x-mark] size-5 opacity-50"></span>
                 </button>
             {/if}
         </div>

         <!-- Cancel Button -->
         <form method="dialog">
            <button class="btn btn-ghost btn-sm text-base-content/70 font-normal">Cancelar</button>
        </form>
    </div>

    <!-- BODY: Results (Scrollable) -->
    <div class="flex-1 overflow-y-auto p-0 bg-base-100">
        {#if searchResults.length > 0}
            <div class="grid grid-cols-1 divide-y divide-base-200">
                 {#each searchResults as product}
                    <a href={`/product/${product.slug}`} class="flex items-center gap-4 p-4 hover:bg-base-200 active:bg-base-200 transition-colors">
                        <!-- Thumb -->
                        <div class="avatar">
                            <div class="w-16 h-16 rounded-lg bg-base-300 relative overflow-hidden flex items-center justify-center">
                                {#if product.image && typeof product.image === 'string' && product.image.length > 5}
                                    <img src={product.image} alt={product.name} class="object-cover w-full h-full" />
                                {:else}
                                    <!-- Lazy Load -->
                                    {#await import('../../utils/productImageLoader.js').then(m => m.fetchProductImage(product.slug, product.id))}
                                        <span class="loading loading-spinner loading-sm text-base-content/30"></span>
                                    {:then url}
                                        {#if url}
                                            <img src={url} alt={product.name} class="object-cover w-full h-full fade-in" />
                                        {:else}
                                             <span class="icon-[heroicons--photo] text-base-content/20 w-8 h-8"></span>
                                        {/if}
                                    {/await}
                                {/if}
                            </div>
                        </div>
                        <!-- Info -->
                        <div class="flex-1 min-w-0">
                             <h4 class="font-medium text-base text-base-content line-clamp-2">{decodeHtmlEntities(product.name)}</h4>
                             <div class="flex justify-between items-center mt-1">
                                 <span class="text-xs text-base-content/50">SKU: {product.sku || '--'}</span>
                                 <span class="text-primary font-bold">{product.price || ''}€</span>
                             </div>
                        </div>
                        <!-- Chevron -->
                         <span class="icon-[heroicons--chevron-right] size-5 text-base-content/30"></span>
                    </a>
                 {/each}
            </div>
            <!-- View All Link -->
            <div class="p-6 text-center">
                 <a href={`/shop?s=${encodeURIComponent(searchValue)}`} class="btn btn-outline btn-primary btn-block btn-sm">Ver todos los resultados</a>
            </div>

        {:else if hasSearched && searchResults.length === 0}
             <!-- No Results -->
             <div class="flex flex-col items-center justify-center py-20 px-10 text-center text-base-content/50">
                <span class="icon-[heroicons--magnifying-glass] size-16 mb-4 opacity-20"></span>
                 <h3 class="font-bold text-lg mb-1">Sin resultados</h3>
                 <p class="text-sm">No encontramos productos para "{searchValue}". Intenta otra búsqueda.</p>
             </div>
        {:else}
             <!-- Initial State / Recommendations can go here -->
             <div class="p-8 text-center text-base-content/40 text-sm">
                 Escribe el nombre o SKU de un producto...
             </div>
        {/if}
    </div>

  </div>
  <form method="dialog" class="modal-backdrop">
    <button>close</button>
  </form>
</dialog>
