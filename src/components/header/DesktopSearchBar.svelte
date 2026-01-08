<script>
  // DesktopSearchBar.svelte
  let searchValue = $state("");
</script>

<div
  class="join border-primary h-12 w-full rounded-lg border-2 max-w-xl hidden lg:flex overflow-hidden"
>
  <input
    class="input join-item h-full w-full rounded-lg border-none pl-4 shadow-none focus:outline-none"
    placeholder="Buscar..."
    bind:value={searchValue}
  />

  <button
    class="btn btn-ghost hover:bg-base-200 text-base-content/70 join-item h-full border-none text-sm font-normal shadow-none"
    popovertarget="popover-1"
    style="anchor-name:--anchor-1"
  >
    Categorías
    <span class="icon-[iconamoon--arrow-down-2-thin] h-5 w-5"></span>
  </button>
  <ul
    class="dropdown dropdown-end menu border-base-200 rounded-sm p-1 bg-base-100 mt-0.5 w-52 border border-solid shadow-lg"
    popover
    id="popover-1"
    style="position-anchor:--anchor-1"
  >
    <li><a>Item 1</a></li>
    <li><a>Item 2</a></li>
  </ul>

  <button
    class="btn btn-square btn-ghost hover:bg-base-200 join-item h-full border-none text-sm shadow-none"
  >
    <span class="icon-[heroicons--magnifying-glass] size-5"></span>
  </button>
</div>
