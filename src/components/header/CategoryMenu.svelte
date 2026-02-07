<script>
    import { onMount } from 'svelte';
    import { decodeHtmlEntities } from '../../utils/formatting';

    // 1. Data Loading (Vite Glob Import)
    const modules = import.meta.glob('/src/data/wp/product-categories/*.json', { eager: true });
    
    // 2. Tree Building Logic
    function buildCategoryTree(modules) {
        const rawCategories = Object.values(modules).map((m) => m.default || m);
        const catMap = new Map();
        rawCategories.forEach(c => {
            catMap.set(c.id, { ...c, children: [] });
        });

        const roots = [];

        for (const cat of catMap.values()) {
            if (cat.parent_id && cat.parent_id !== 0) {
                const parent = catMap.get(cat.parent_id);
                if (parent) {
                    parent.children.push(cat);
                } else {
                    roots.push(cat);
                }
            } else {
                roots.push(cat);
            }
        }
        return roots;
    }

    // 3. Sorting Logic
    function sortCategoriesIterative(categories) {
        if (!categories || categories.length === 0) return [];
        return categories.sort((a, b) => {
            const aHasChildren = a.children.length > 0;
            const bHasChildren = b.children.length > 0;
            if (aHasChildren && !bHasChildren) return -1;
            if (!aHasChildren && bHasChildren) return 1;
            return (a.name || '').localeCompare(b.name || '');
        }).map(cat => {
            if (cat.children.length > 0) {
                cat.children = sortCategoriesIterative(cat.children);
            }
            return cat;
        });
    }

    // 4. Initialize Runs
    let rootCategories = $state([]);
    const treeRoots = buildCategoryTree(modules);
    rootCategories = sortCategoriesIterative(treeRoots);

</script>

<div>
<div class="dropdown dropdown-hover ">
  <!-- Trigger Button -->
  <div tabindex="0" role="button" class="flex cursor-pointer items-center gap-2 px-2 py-1 rounded-sm hover:bg-base-100/10 transition-colors">
    <span class="icon-[heroicons--bars-3] size-7"></span>
    <span class="font-medium text-sm">Menu</span>
  </div>

  <ul tabindex="0" class="dropdown-content text-base-content z-[999] menu p-2 shadow bg-base-100 rounded-sm w-64 border border-base-200 ">
    {#if rootCategories.length === 0}
        <li class="disabled"><a>Sin categorías...</a></li>
    {:else}
        {#each rootCategories as cat}
             {@render categoryItem(cat)}
        {/each}
    {/if}
  </ul>
</div>

<!-- Recursive Snippet for Menu Items -->
{#snippet categoryItem(cat)}
    <li class={cat.children.length > 0 ? "group relative" : ""}>
        <a 
            href={`/product-category/${cat.slug}`} 
            class="justify-between "
        >
            <span class="flex items-center gap-2">
                {decodeHtmlEntities(cat.name)}
                {#if cat.count}
                    <span class="text-xs opacity-50">({cat.count})</span>
                {/if}
            </span>
            
            {#if cat.children.length > 0}
                <span class="icon-[heroicons--chevron-right-20-solid] size-4 opacity-50"></span>
            {/if}
        </a>

        <!-- Submenu (Right side on hover) -->
        {#if cat.children.length > 0}
            <ul class="hidden group-hover:block absolute left-full top-0 ml-1 p-2 bg-base-100 shadow rounded-sm w-56 border border-base-200 z-[1000]">
                 {#each cat.children as child}
                      {@render categoryItem(child)}
                 {/each}
            </ul>
        {/if}
    </li>
{/snippet}
</div>