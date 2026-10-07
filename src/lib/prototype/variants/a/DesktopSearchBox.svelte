<!--
  PROTOTYPE：桌面顶栏里的搜索框（照官方客户端）。点进去或按 Ctrl K，框下面挂出下拉：没输入时是搜索历史，输入时是建议。
  Enter / 点建议 → 内容区打开“搜索结果”页，顶栏和侧栏照常能用；没有遮罩。Esc 或点别处收起下拉。
  地址里 screen=search 但没有 stab（例如“去搜一首”按钮、分享出来的地址）= 下拉开着，盖在原来的页面上。
-->
<script lang='ts'>
  import { langOf } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { Search, X } from '@lucide/svelte'
  import SearchPanel from './SearchPanel.svelte'

  let box = $state<HTMLElement>()
  let input = $state<HTMLInputElement>()
  let panel = $state<ReturnType<typeof SearchPanel>>()
  let active = $state(-1)

  /** 框里的字：在搜索结果页时是那次搜索的词，别处为空；打字时临时改写 */
  let draft = $derived(nav.screen === 'search' ? nav.query : '')
  /** 下拉是否开着：还没按搜索的搜索状态默认开着；点进框里、按 Ctrl K 时打开 */
  let open = $derived(nav.screen === 'search' && !nav.stab)

  $effect(() => {
    if (nav.screen === 'search' && !nav.stab)
      input?.focus({ preventScroll: true })
  })

  /** Ctrl K：打开下拉，选中框里已有的字 */
  export function focus() {
    open = true
    input?.focus({ preventScroll: true })
    input?.select()
  }

  function close() {
    open = false
    active = -1
    draft = nav.screen === 'search' ? nav.query : ''
    // “还没按搜索”本身是一个界面状态，收起时回到原来的页面
    if (nav.screen === 'search' && !nav.stab)
      nav.closeSearch()
  }

  function clear() {
    draft = ''
    active = -1
    open = true
    input?.focus()
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
      input?.blur()
      return
    }
    open = true
    if (panel?.onkey(e) && e.key === 'Enter')
      input?.blur()
  }

  function onpointerdown(e: PointerEvent) {
    if (open && box && !box.contains(e.target as Node))
      close()
  }
</script>

<svelte:window {onpointerdown} />

<div bind:this={box} class='relative mx-auto w-full max-w-[560px]' role='search'>
  <div class={['field flex h-11 items-center gap-3 rounded-full border bg-white pl-4 pr-2', open ? 'is-open border-primary-500' : 'border-neutral-200']}>
    <Search size={18} class='flex-none text-neutral-500' aria-hidden='true' />
    <input
      bind:this={input}
      value={draft}
      oninput={(e) => {
        draft = e.currentTarget.value
        active = -1
        open = true
      }}
      onfocus={() => (open = true)}
      {onkeydown}
      type='search'
      class='min-w-0 flex-1 bg-transparent text-[14.5px] text-neutral-900 outline-none placeholder:text-neutral-500'
      placeholder='搜索歌曲、歌单、歌手、专辑'
      aria-label='搜索歌曲、歌单、歌手、专辑'
      role='combobox'
      aria-expanded={open}
      aria-controls={open && draft.trim() ? 'dsb-list' : undefined}
      aria-autocomplete='list'
      aria-activedescendant={open && draft.trim() && active >= 0 ? `dsb-${active}` : undefined}
      lang={draft ? langOf(draft) : undefined}
      autocomplete='off'
      spellcheck='false'
    />
    {#if draft}
      <button class='ghost grid size-8 flex-none place-items-center rounded-full text-neutral-600' aria-label='清除搜索词' onclick={clear}>
        <X size={16} aria-hidden='true' />
      </button>
    {:else if !open}
      <kbd class='flex-none rounded-md border border-neutral-200 bg-neutral-50 px-1.5 font-sans text-[11px] leading-5 text-neutral-600'>Ctrl K</kbd>
    {/if}
  </div>

  {#if open}
    <div class='drop absolute inset-x-0 top-[calc(100%+8px)] z-50 max-h-[min(560px,70vh)] overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-float'>
      <SearchPanel bind:this={panel} bind:active query={draft} suggestOnly idPrefix='dsb' />
    </div>
  {/if}
</div>

<style>
  .field {
    transition: border-color 120ms ease-out, box-shadow 120ms ease-out;
  }

  .field.is-open {
    box-shadow: 0 0 0 3px #e8f8f1;
  }

  .field input::-webkit-search-cancel-button {
    display: none;
  }

  .field input:focus-visible {
    outline: none;
  }

  .drop {
    animation: drop 160ms cubic-bezier(0.2, 0, 0, 1);
  }

  @keyframes drop {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .drop {
      animation: none;
    }
  }

  @media (hover: hover) and (pointer: fine) {
    .field:not(.is-open):hover {
      border-color: #b9ead5;
    }

    .ghost:hover {
      background: #e8f8f1;
      color: #1a5b43;
    }
  }
</style>
