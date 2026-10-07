<!-- PROTOTYPE（变体 C）：顶栏中间的搜索框，整个变体的脊梁。
  曲库里：打字即出下拉面板（曲库中 / 歌单 / 歌手 / 网易云）；
  歌单页里：自动限定到这份列表（框里有“在：…”标签），打字就地过滤列表，不弹面板。 -->
<script lang='ts'>
  import type { ResultItem } from '../results'
  import { Search, X } from '@lucide/svelte'
  import { formatCount } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { collectionOf } from '../collections'
  import { activate, buildResults, itemKey } from '../results'
  import SearchResults from '../SearchResults.svelte'
  import { ui } from '../ui.svelte'

  let input = $state<HTMLInputElement>()
  let wrap = $state<HTMLElement>()
  let active = $state(-1)

  const scoped = $derived(nav.screen === 'playlist')
  const scope = $derived(scoped ? collectionOf(nav.playlistId) : null)
  const open = $derived(ui.searchOpen && !scoped)
  const results = $derived(open ? buildResults(nav.query) : null)

  $effect(() => {
    if (ui.focusTick > 0)
      input?.focus()
  })

  // 结果变化时键盘高亮回到起点
  $effect(() => {
    void nav.query
    active = -1
  })

  function pick(item: ResultItem) {
    if (!results)
      return
    if (activate(item, results)) {
      ui.searchOpen = false
      input?.blur()
    }
  }

  function unscope() {
    nav.goLibrary()
    ui.searchOpen = true
    input?.focus()
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (open) {
        ui.searchOpen = false
      }
      else if (nav.query) {
        nav.query = ''
      }
      else {
        input?.blur()
      }
      e.preventDefault()
      return
    }
    if (scoped) {
      if (e.key === 'Backspace' && nav.query === '' && input?.selectionStart === 0)
        unscope()
      else if (e.key === 'Enter')
        ui.remember(nav.query)
      return
    }
    if (!results) {
      if (e.key === 'ArrowDown')
        ui.searchOpen = true
      return
    }
    const n = results.query.trim() ? results.items.length : 0
    if (e.key === 'ArrowDown' && n > 0) {
      e.preventDefault()
      active = (active + 1) % n
    }
    else if (e.key === 'ArrowUp' && n > 0) {
      e.preventDefault()
      active = active <= 0 ? n - 1 : active - 1
    }
    else if (e.key === 'Enter' && n > 0) {
      e.preventDefault()
      const item = active >= 0 ? results.items[active] : results.items.find(i => i.kind === 'all') ?? results.items[0]
      pick(item)
    }
  }

  function onpointerdown(e: PointerEvent) {
    if (open && wrap && !wrap.contains(e.target as Node))
      ui.searchOpen = false
  }

  const activeId = $derived(results && active >= 0 && results.items[active] ? `dsr-${itemKey(results.items[active])}` : undefined)
</script>

<svelte:window {onpointerdown} />

<div bind:this={wrap} class='relative w-full max-w-[640px]'>
  <div class='field' class:open>
    <Search size={18} class='shrink-0 text-neutral-500' aria-hidden='true' />
    {#if scope}
      <span class='scope'>
        <span class='truncate'>在：{scope.name}</span>
        <button type='button' class='scope-x' aria-label='取消限定，搜索整个曲库' onclick={unscope}>
          <X size={14} strokeWidth={2.25} aria-hidden='true' />
        </button>
      </span>
    {/if}
    <input
      bind:this={input}
      type='search'
      class='min-w-0 flex-1 bg-transparent text-[15px] text-neutral-900 outline-none'
      placeholder={scope ? `在 ${formatCount(scope.songs.length)} 首中搜索` : '搜索曲库和网易云'}
      aria-label={scope ? `在${scope.name}中搜索` : '搜索曲库和网易云'}
      aria-keyshortcuts='/'
      role='combobox'
      aria-expanded={open}
      aria-controls='dsr-listbox'
      aria-autocomplete='list'
      aria-activedescendant={activeId}
      autocomplete='off'
      spellcheck='false'
      value={nav.query}
      oninput={(e) => {
        nav.query = e.currentTarget.value
        if (!scoped)
          ui.searchOpen = true
      }}
      onfocus={() => {
        if (!scoped)
          ui.searchOpen = true
      }}
      {onkeydown}
    />
    {#if nav.query}
      <button type='button' class='clear' aria-label='清除搜索词' onclick={() => {
        nav.query = ''
        input?.focus()
      }}>
        <X size={16} aria-hidden='true' />
      </button>
    {:else}
      <kbd aria-hidden='true'>/</kbd>
    {/if}
  </div>

  {#if open && results}
    <div class='panel' role='dialog' aria-label='即时搜索'>
      <SearchResults {results} {active} idPrefix='dsr' onpick={pick} />
    </div>
  {/if}
</div>

<style>
  .field {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 44px;
    padding: 0 10px 0 14px;
    border-radius: 12px;
    background: #fff;
    box-shadow: 0 1px 2px rgb(17 24 39 / 0.04), 0 4px 16px -4px rgb(17 24 39 / 0.07);
    transition: box-shadow 160ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .field:focus-within {
    box-shadow: 0 0 0 2px #2b976f, 0 4px 16px -4px rgb(17 24 39 / 0.07);
  }

  .field input::placeholder {
    color: #6b7280;
  }

  .field input::-webkit-search-cancel-button {
    display: none;
  }

  .field input:focus-visible {
    outline: none;
  }

  .scope {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    gap: 2px;
    max-width: 240px;
    height: 28px;
    padding: 0 2px 0 8px;
    border-radius: 6px;
    background: #e8f8f1;
    color: #1a5b43;
    font-size: 13px;
    font-weight: 500;
  }

  .scope-x {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    border-radius: 4px;
  }

  .clear {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    color: #6b7280;
  }

  kbd {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    box-shadow: inset 0 0 0 1px #d1d5db;
    font-family: inherit;
    font-size: 12px;
    color: #6b7280;
  }

  .panel {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    z-index: 60;
    max-height: calc(100dvh - 72px - 96px);
    overflow: auto;
    overscroll-behavior: contain;
    border-radius: 16px;
    background: #fff;
    box-shadow: 0 2px 8px rgb(17 24 39 / 0.06), 0 16px 40px -12px rgb(17 24 39 / 0.18);
    animation: drop 180ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes drop {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
  }

  @media (hover: hover) and (pointer: fine) {
    .scope-x:hover,
    .clear:hover {
      background: #d1f1e3;
      color: #1a5b43;
    }
  }
</style>
