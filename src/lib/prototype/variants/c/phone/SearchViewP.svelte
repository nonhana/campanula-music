<!-- PROTOTYPE（变体 C）：手机全屏搜索。没有搜索词时是搜索历史；打字即出分组结果（曲库中 / 歌单 / 歌手 / 网易云），命中的字即时点亮。 -->
<script lang='ts'>
  import type { ResultItem } from '../results'
  import { ArrowLeft, X } from '@lucide/svelte'
  import { nav } from '$lib/prototype/nav.svelte'
  import { activate, buildResults } from '../results'
  import SearchResults from '../SearchResults.svelte'
  import { ui } from '../ui.svelte'

  let input = $state<HTMLInputElement>()
  const results = $derived(buildResults(nav.query))

  $effect(() => {
    if (ui.focusTick > 0)
      input?.focus()
  })

  function close() {
    ui.searchOpen = false
    nav.query = ''
  }

  function pick(item: ResultItem) {
    if (activate(item, results))
      ui.searchOpen = false
    else input?.blur()
  }
</script>

<div class='fixed inset-0 z-40 flex flex-col bg-white' role='dialog' aria-modal='true' aria-label='搜索'>
  <div class='shrink-0 bg-primary-100 px-3 pb-3 pt-2.5'>
    <div class='field'>
      <button type='button' class='icon' aria-label='返回' onclick={close}><ArrowLeft size={22} aria-hidden='true' /></button>
      <input
        bind:this={input}
        type='search'
        enterkeyhint='search'
        class='min-w-0 flex-1 bg-transparent text-base text-neutral-900 outline-none'
        placeholder='搜索曲库和网易云'
        aria-label='搜索曲库和网易云'
        autocomplete='off'
        spellcheck='false'
        value={nav.query}
        oninput={e => (nav.query = e.currentTarget.value)}
        onkeydown={(e) => {
          if (e.key === 'Escape')
            close()
          else if (e.key === 'Enter') {
            ui.remember(nav.query)
            input?.blur()
          }
        }}
      />
      {#if nav.query}
        <button type='button' class='icon' aria-label='清除搜索词' onclick={() => {
          nav.query = ''
          input?.focus()
        }}><X size={20} aria-hidden='true' /></button>
      {/if}
    </div>
  </div>
  <div class='min-h-0 flex-1 overflow-y-auto overscroll-contain pb-8'>
    <SearchResults {results} idPrefix='psr' phone onpick={pick} />
  </div>
</div>

<style>
  .field {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 48px;
    padding: 0 4px;
    border-radius: 999px;
    background: #fff;
    box-shadow: 0 1px 2px rgb(17 24 39 / 0.04), 0 4px 16px -4px rgb(17 24 39 / 0.07);
  }

  .field:focus-within {
    box-shadow: 0 0 0 2px #2b976f;
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

  .icon {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border-radius: 999px;
    color: #374151;
  }
</style>
