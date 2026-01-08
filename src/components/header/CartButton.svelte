<script>
  // CartButton.svelte
  let count = $state(0);
</script>

<button
  class="indicator btn btn-ghost btn-circle bg-base-200 hover:bg-base-200 flex items-center border-0"
>
  <span class="icon-[heroicons--shopping-bag] size-7"></span>
  <span
    class="btn btn-circle indicator-item btn-xs btn-primary text-base-content pointer-events-none top-2 right-2 size-5 scale-90 border-0 p-0 text-[10px] font-bold"
    >{count}</span
  >
</button>
