<!--
  PROTOTYPE：手机搜索整页——顶栏是返回 + 输入框 + 清除；下面是历史 / 建议 / 结果。
-->
<script lang='ts'>
  import { langOf } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { ArrowLeft, Search, X } from '@lucide/svelte'
  import SearchPanel from './SearchPanel.svelte'

  let input = $state<HTMLInputElement>()
  let panel = $state<ReturnType<typeof SearchPanel>>()
  let active = $state(-1)
  const listOpen = $derived(Boolean(nav.query.trim()) && !nav.stab)

  $effect(() => {
    if (!nav.stab)
      input?.focus()
  })

  function oninput(e: Event) {
    nav.query = (e.currentTarget as HTMLInputElement).value
    nav.stab = ''
  }

  function onkeydown(e: KeyboardEvent) {
    if (panel?.onkey(e) && e.key === 'Enter')
      input?.blur()
  }

  function clear() {
    nav.query = ''
    nav.stab = ''
    input?.focus()
  }
</script>

<div class='sticky top-0 z-20 flex h-14 items-center gap-1 bg-primary-50 pl-1 pr-3'>
  <button class='grid size-11 flex-none place-items-center rounded-full text-neutral-800 active:bg-primary-100' aria-label='返回' onclick={() => nav.closeSearch()}>
    <ArrowLeft size={22} aria-hidden='true' />
  </button>
  <form class='field flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-neutral-200 bg-white pl-3.5 pr-1' role='search' onsubmit={e => e.preventDefault()}>
    <Search size={17} class='flex-none text-neutral-500' aria-hidden='true' />
    <input
      bind:this={input}
      value={nav.query}
      {oninput}
      {onkeydown}
      type='search'
      enterkeyhint='search'
      class='min-w-0 flex-1 bg-transparent text-[16px] text-neutral-900 outline-none placeholder:text-neutral-500'
      placeholder='搜索歌曲、歌单、歌手、专辑'
      aria-label='搜索歌曲、歌单、歌手、专辑'
      role='combobox'
      aria-expanded={listOpen}
      aria-controls={listOpen ? 'psg-list' : undefined}
      aria-autocomplete='list'
      aria-activedescendant={listOpen && active >= 0 ? `psg-${active}` : undefined}
      lang={nav.query ? langOf(nav.query) : undefined}
      autocomplete='off'
      spellcheck='false'
    />
    {#if nav.query}
      <button type='button' class='grid size-9 flex-none place-items-center rounded-full text-neutral-600 active:bg-primary-100' aria-label='清除' onclick={clear}>
        <X size={17} aria-hidden='true' />
      </button>
    {/if}
  </form>
</div>

<div class='pb-28'>
  <SearchPanel phone bind:this={panel} bind:active idPrefix='psg' />
</div>

<style>
  .field:focus-within {
    border-color: #59cfa3;
  }

  .field input::-webkit-search-cancel-button {
    display: none;
  }
</style>
