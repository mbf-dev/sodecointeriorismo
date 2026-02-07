<script>
    import { onMount } from 'svelte';
    import menusData from '../../data/wp/menus.json';
    import siteSettings from '../../data/wp/site-settings.json';
    import { decodeHtmlEntities } from '../../utils/formatting';

    // 1. Data Loading for Categories (Vite Glob Import)
    const modules = import.meta.glob('/src/data/wp/product-categories/*.json', { eager: true });
    
    // 2. Tree Building Logic (Reused from CategoryMenu)
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

    // Initialize Data
    let rootCategories = $state([]);
    const treeRoots = buildCategoryTree(modules);
    rootCategories = sortCategoriesIterative(treeRoots);

    const headerMenu = menusData.header_menu || [];
    const socials = siteSettings.socials || [];
    
    // Logo Helper
    const getLogoSrc = (logo) => {
        if (!logo) return '/images/logo-placeholder.svg';
        if (logo.optimized?.src) return logo.optimized.src;
        return logo.url || '/images/logo-placeholder.svg';
    };
    
    // Using Mobile Logo by default for the mobile menu
    const logoSrc = getLogoSrc(siteSettings.logos?.desktop);

    // Social Icon Helper
    function getSocialIcon(network) {
        const map = {
            'instagram': 'icon-[fa6-brands--instagram]',
            'facebook': 'icon-[fa6-brands--facebook]',
            'twitter': 'icon-[fa6-brands--x-twitter]',
            'linkedin': 'icon-[fa6-brands--linkedin]',
            'youtube': 'icon-[fa6-brands--youtube]',
            'tiktok': 'icon-[fa6-brands--tiktok]'
        };
        return map[network.toLowerCase()] || 'icon-[heroicons--link]';
    }
</script>

<div class="drawer">
  <input id="mobile-drawer" type="checkbox" class="drawer-toggle" />
  <div class="drawer-content">
    <!-- Trigger Button -->
    <label for="mobile-drawer" class="btn btn-ghost btn-square hover:bg-base-200 border-0 cursor-pointer">
        <span class="icon-[iconamoon--menu-burger-horizontal-light] size-7"></span>
    </label>
  </div> 
  <div class="drawer-side z-[9999]">
    <label for="mobile-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
    <div class="menu p-4 w-80 min-h-full bg-base-100 text-base-content flex flex-col">
        
        <!-- Header: Logo -->
        <div class="  flex justify-start py-4 border-b border-base-200">
             <img src={logoSrc} alt="Menu Logo" class="h-10 w-auto dark:invert" />
        </div>

        <!-- 2-Tab System -->
        <div role="tablist" class="tabs tabs-box bg-base-100 mb-4  ">
            <!-- Tab 1: Menu -->
            <input type="radio" name="mobile_tabs" role="tab" class="tab font-bold w-1/2 checked:bg-primary bg-base-300 -ml-2" aria-label="Menu" checked />
            <div role="tabpanel" class="tab-content bg-base-100 border-t border-b-0 border-x-0 border-base-200 pt-4 ">
                 <ul class="menu w-full gap-2 p-0">
                    {#each headerMenu as item}
                        <li>
                            <a href={item.url} target={item.target} class="p-2 w-full ">
                                {decodeHtmlEntities(item.title)}
                            </a>
                            {#if item.children && item.children.length > 0}
                                <ul>
                                    {#each item.children as child}
                                        <li><a class="p-2" href={child.url}>{decodeHtmlEntities(child.title)}</a></li>
                                    {/each}
                                </ul>
                            {/if}
                        </li>
                    {/each}
                    {#if headerMenu.length === 0}
                         <li><span class="opacity-50">Sin elementos</span></li>
                    {/if}
                 </ul>
            </div>

            <!-- Tab 2: Categorías -->
            <input type="radio" name="mobile_tabs" role="tab" class="tab font-bold w-1/2 checked:bg-primary bg-base-300 ml-2" aria-label="Categorías" />
            <div role="tabpanel" class="tab-content bg-base-100 border-t border-b-0 border-x-0 border-base-200 pt-4 ">
                 <ul class="menu w-full gap-1 p-0">
                     {#each rootCategories as cat}
                        {@render categoryItem(cat)}
                     {/each}
                 </ul>
            </div>
        </div>

        <!-- Footer: Socials -->
        <div class="mt-auto pt-4 border-t border-base-200">
            <div class="flex justify-start gap-6">
                 {#each socials as social}
                    <a 
                        href={social.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        class="btn btn-ghost btn-circle btn-sm hover:text-primary transition-colors"
                        aria-label={social.network}
                    >
                        <span class={`${getSocialIcon(social.network)} size-5`}></span>
                    </a>
                 {/each}
            </div>
        </div>

    </div>
  </div>
</div>

<!-- Recursive Category Item Snippet -->
{#snippet categoryItem(cat)}
    <li>
        {#if cat.children.length > 0}
            <details>
                <summary class=" ">
                    {decodeHtmlEntities(cat.name)}
                    {#if cat.count}
                        <span class="text-xs opacity-50 font-normal">({cat.count})</span>
                    {/if}
                </summary>
                <ul>
                    {#each cat.children as child}
                         {@render categoryItem(child)}
                    {/each}
                </ul>
            </details>
        {:else}
            <a href={`/product-category/${cat.slug}`} class="  ">
                {decodeHtmlEntities(cat.name)}
                {#if cat.count}
                    <span class="text-xs opacity-50 font-normal">({cat.count})</span>
                {/if}
            </a>
        {/if}
    </li>
{/snippet}
