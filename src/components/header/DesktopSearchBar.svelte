<script>
    import { onMount } from 'svelte';
    import Fuse from 'fuse.js'; // Fuzzy Search Library
    import { decodeHtmlEntities } from '../../utils/formatting';
    
    // Import Data
    import searchIndex from '/src/data/wp/search-index.json'; // The lightweight index we generated
    const modules = import.meta.glob('/src/data/wp/product-categories/*.json', { eager: true });
    
    // State
    let searchValue = $state("");
    let selectedCategory = $state(null); // null = All Categories
    let categories = $state([]);
    let searchResults = $state([]);
    let isDropdownOpen = $state(false);
    let fuse; // Fuse instance
    
    // ----------------------------
    // 1. Initialize logic
    // ----------------------------
    onMount(() => {
        // Load Categories
        const allCats = Object.values(modules).map((m) => m.default || m);
        categories = allCats.filter(c => !c.parent_id || c.parent_id === 0)
                            .sort((a,b) => (a.name || '').localeCompare(b.name || ''));

        // Initialize Fuse.js for fast search
        // Keys: name (weight 0.7), sku (weight 0.3)
        // Threshold: 0.3 (lower is stricter)
        const options = {
            keys: [
                { name: 'name', weight: 0.7 },
                { name: 'sku', weight: 0.3 }
            ],
            threshold: 0.3,
            ignoreLocation: true 
        };
        fuse = new Fuse(searchIndex, options);
    });

    // ----------------------------
    // 2. Search Logic
    // ----------------------------
    function performSearch() {
        if (!searchValue.trim()) {
            searchResults = [];
            isDropdownOpen = false;
            return;
        }

        // 1. Full text search via Fuse
        let results = fuse.search(searchValue).map(res => res.item);

        // 2. Filter by Category if selected
        if (selectedCategory) {
            results = results.filter(item => 
                item.category_ids && item.category_ids.includes(selectedCategory.id)
            );
        }

        // 3. Limit results for performance
        searchResults = results.slice(0, 8); // Show max 8
        isDropdownOpen = true; // Always open if search has value
    }

    // Trigger search on input change
    $effect(() => {
        performSearch();
    });

    // Handle Category Select
    function selectCategory(cat) {
        selectedCategory = cat;
        performSearch(); // Re-search with new filter
        // Close popover logic handled by daisyUI automatically usually via focus loss, 
        // but we might need to manually close if using custom dropdown
    }

    // Close dropdown on click outside handled by blur mostly, 
    // but explicit close helper:
    function closeDropdown() {
        // Delay to allow click on link to register
        setTimeout(() => isDropdownOpen = false, 200);
    }
</script>

<div class="relative w-full max-w-xl group z-50">
    
    <!-- SEARCH BAR CONTAINER (Input + Button) -->
    <div class="join border-primary h-12 w-full rounded-lg border-2 hidden lg:flex overflow-visible relative bg-base-100">
        
        <!-- INPUT -->
        <input
            class="input join-item h-full w-full rounded-lg border-none pl-4 shadow-none focus:outline-none"
            placeholder="Buscar..."
            bind:value={searchValue}
            onfocus={() => { if(searchValue) isDropdownOpen = true; }}
            onblur={closeDropdown}
        />

        <!-- CATEGORY DROPDOWN TRIGGER (Native Popover API from original code or DaisyUI Dropdown) -->
        <!-- Using DaisyUI dropdown class for easier styling control -->
        <div class="dropdown dropdown-end join-item">
            <div 
                tabindex="0" 
                role="button" 
                class="btn btn-ghost hover:bg-base-200 text-base-content/70 h-full border-none text-sm font-normal shadow-none rounded-none px-4 w-max"
            >
                {selectedCategory ? decodeHtmlEntities(selectedCategory.name) : 'Categorías'}
                <span class="icon-[iconamoon--arrow-down-2-thin] h-5 w-5"></span>
            </div>
            
            <!-- CATEGORY LIST -->
            <ul tabindex="0" class="dropdown-content z-[9990] menu p-2 shadow bg-base-100 rounded-sm w-52 mt-1 border border-base-200 block overflow-y-auto max-h-80">
                <li>
                    <button 
                        class={!selectedCategory ? "active font-bold" : ""}
                        onclick={() => selectCategory(null)}
                    >
                        Todas las Categorías
                    </button>
                </li>
                {#each categories as cat}
                    <li>
                        <button 
                            class={selectedCategory?.id === cat.id ? "active font-bold" : ""}
                            onclick={() => selectCategory(cat)}
                        >
                            {decodeHtmlEntities(cat.name)}
                        </button>
                    </li>
                {/each}
            </ul>
        </div>

        <!-- SEARCH ICON BUTTON -->
        <button class="btn btn-square btn-ghost hover:bg-base-200 join-item h-full border-none text-sm shadow-none">
            <span class="icon-[heroicons--magnifying-glass] size-5"></span>
        </button>
    </div>

    <!-- LIVE SEARCH RESULTS DROPDOWN (Card As Dropdown Style) -->
    <!-- Position absolute relative to the search container -->
    {#if isDropdownOpen}
        <div 
            class="dropdown-content card card-compact absolute top-full left-0 w-full bg-base-100 shadow-xl border border-base-200 mt-2 z-[99999] overflow-hidden"
            onmousedown={(e) => e.preventDefault()} 
        >
             <!-- Prevent blur default behavior on click inside -->
            <div class="card-body p-0 max-h-[400px] overflow-y-auto scrollbar-thin">
                {#if searchResults.length > 0}
                    <ul class="menu w-full p-0">
                        {#each searchResults as product}
                            <li class="border-b border-base-100 last:border-none">
                                <a 
                                    href={`/product/${product.slug}`} 
                                    class="flex items-center gap-4 py-3 px-4 hover:bg-base-200 transition-colors"
                                >
                                    <!-- Image Thumbnail with Lazy Load logic -->
                                    <div class="avatar">
                                        <div class="w-12 h-12 rounded bg-base-300 relative overflow-hidden flex items-center justify-center">
                                            {#if product.image && typeof product.image === 'string' && product.image.length > 5}
                                                <img src={product.image} alt={product.name} class="object-cover w-full h-full" />
                                            {:else}
                                                <!-- Lazy Load / Placeholder -->
                                                {#await import('../../utils/productImageLoader.js').then(m => m.fetchProductImage(product.slug, product.id))}
                                                    <span class="loading loading-spinner loading-xs text-base-content/30"></span>
                                                {:then url}
                                                    {#if url}
                                                        <img src={url} alt={product.name} class="object-cover w-full h-full fade-in" />
                                                    {:else}
                                                       <span class="icon-[heroicons--photo] text-base-content/20 w-6 h-6"></span>
                                                    {/if}
                                                {/await}
                                            {/if}
                                        </div>
                                    </div>
                                    
                                    <!-- Content -->
                                    <div class="flex-1 min-w-0">
                                        <h4 class="font-medium text-sm truncate text-base-content">
                                            {decodeHtmlEntities(product.name)}
                                        </h4>
                                        <div class="flex justify-between items-center mt-1">
                                            <span class="text-xs text-base-content/60">SKU: {product.sku || 'N/A'}</span>
                                            <span class="text-sm font-bold text-primary">{product.price || ''}€</span>
                                        </div>
                                    </div>
                                </a>
                            </li>
                        {/each}
                    </ul>
                    <!-- Footer Link -->
                    <div class="p-2 border-t border-base-200 bg-base-50 text-center">
                        <a href={`/shop?s=${encodeURIComponent(searchValue)}`} class="link link-primary text-sm font-medium">Ver todos los resultados</a>
                    </div>
                {:else}
                    <!-- Empty State -->
                    <div class="p-8 text-center flex flex-col items-center text-base-content/60">
                        <span class="icon-[heroicons--magnifying-glass] size-10 mb-2 opacity-50"></span>
                        <span class="font-medium">No se encontraron productos</span>
                        <span class="text-xs mt-1">Intenta con otro término o categoría</span>
                    </div>
                {/if}
            </div>
        </div>
    {/if}
</div>
