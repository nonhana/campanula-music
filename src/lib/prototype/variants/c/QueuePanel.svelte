<!-- PROTOTYPE（变体 C）：播放队列。自带“在播放队列中搜索”，打字即时过滤并点亮；虚拟列表，标出当前歌曲，有“清空”。 -->
<script lang='ts'>
  import type { Song } from '$lib/prototype/data'
  import { AudioLines, Ellipsis, Search, X } from '@lucide/svelte'
  import Cover from '$lib/prototype/Cover.svelte'
  import { artistLine, formatCount, formatDuration } from '$lib/prototype/data'
  import { player } from '$lib/prototype/player.svelte'
  import VirtualList from '$lib/prototype/VirtualList.svelte'
  import Hl from './Hl.svelte'
  import { filterIndexed } from './search'
  import { ui } from './ui.svelte'

  interface Props {
    phone?: boolean
  }

  const { phone = false }: Props = $props()

  let q = $state('')
  let scroller = $state<HTMLElement | null>(null)
  const rowH = $derived(phone ? 64 : 56)

  const rows = $derived(filterIndexed(player.queue, q))
  const searching = $derived(q.trim() !== '')

  // 打开时把当前歌曲滚到视野里
  let scrolled = false
  $effect(() => {
    if (!scroller || scrolled)
      return
    scrolled = true
    scroller.scrollTop = Math.max(0, player.index * rowH - rowH * 2)
  })

  function jump(index: number, s: Song) {
    if (s.unavailable)
      return
    player.index = index
    player.position = 0
    player.playing = true
  }
</script>

<div class='flex h-full min-h-0 flex-col'>
  <div class='shrink-0' class:px-4={phone} class:px-5={!phone}>
    <label class='field' class:phone>
      <Search size={16} class='shrink-0 text-neutral-500' aria-hidden='true' />
      <input
        type='search'
        bind:value={q}
        placeholder='在播放队列中搜索'
        aria-label='在播放队列中搜索'
        autocomplete='off'
        spellcheck='false'
        onkeydown={(e) => {
          if (e.key === 'Escape' && q) {
            e.preventDefault()
            e.stopPropagation()
            q = ''
          }
        }}
      />
      {#if q}
        <button type='button' class='clear' aria-label='清除搜索词' onclick={() => (q = '')}><X size={14} aria-hidden='true' /></button>
      {/if}
    </label>
    <div class='mt-2 flex h-8 items-center gap-3 text-xs text-neutral-600'>
      {#if searching}
        <p aria-live='polite'>找到 <span class='tnum text-neutral-900 font-600'>{formatCount(rows.length)}</span> 首<span class='tnum text-neutral-500'> / {formatCount(player.queue.length)}</span></p>
      {:else}
        <p class='min-w-0 truncate'><span class='tnum'>{formatCount(player.queue.length)} 首</span> · 来自「{player.source.name}」</p>
      {/if}
      <button type='button' class='clear-all ml-auto' onclick={() => player.clear()} disabled={player.queue.length <= 1}>清空</button>
    </div>
  </div>

  <div bind:this={scroller} class='scroll min-h-0 flex-1' class:px-2={phone} class:px-3={!phone}>
    {#if rows.length === 0}
      <p class='px-3 py-10 text-center text-sm text-neutral-500'>播放队列里没有和“{q.trim()}”匹配的歌曲。</p>
    {:else}
      <VirtualList items={rows} itemHeight={rowH} scrollParent={scroller} getKey={r => r.index}>
        {#snippet row(r: { song: Song, index: number })}
          {@const s = r.song}
          {@const now = r.index === player.index}
          <div
            class='qrow'
            class:now
            class:off={s.unavailable}
            class:phone
            oncontextmenu={(e) => {
              e.preventDefault()
              ui.openMenu(s, e, phone)
            }}
          >
            <button type='button' class='hit' aria-label={s.unavailable ? `${s.title}（无版权）` : `播放 ${s.title}`} aria-current={now ? 'true' : undefined} onclick={() => jump(r.index, s)}></button>
            <span class='pos tnum'>
              {#if now}<AudioLines size={16} strokeWidth={2.25} class='text-primary-800' aria-hidden='true' />{:else}{r.index + 1}{/if}
            </span>
            <Cover cover={s.cover} class='dim {phone ? 'size-12' : 'size-10'} shrink-0 rounded-lg' />
            <span class='dim min-w-0 flex-1'>
              <span class='t' lang={s.lang}><Hl text={s.title} query={q} /></span>
              <span class='a' lang={s.lang}>{#if s.unavailable}无版权 · {/if}<Hl text={artistLine(s)} query={q} /></span>
            </span>
            {#if !phone}<span class='dim tnum text-xs text-neutral-500'>{formatDuration(s.duration)}</span>{/if}
            <button type='button' class='more' aria-label='{s.title} 的更多操作' aria-haspopup='menu' onclick={e => ui.openMenu(s, e, phone)}>
              <Ellipsis size={18} aria-hidden='true' />
            </button>
          </div>
        {/snippet}
      </VirtualList>
    {/if}
  </div>
</div>

<style>
  .field {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 40px;
    padding: 0 8px 0 12px;
    border-radius: 10px;
    background: #f3f4f6;
    transition: box-shadow 160ms cubic-bezier(0.16, 1, 0.3, 1), background-color 160ms;
  }

  .field.phone {
    height: 44px;
    border-radius: 12px;
  }

  .field:focus-within {
    background: #fff;
    box-shadow: 0 0 0 2px #2b976f;
  }

  .field input {
    min-width: 0;
    flex: 1;
    background: transparent;
    font-size: 14px;
    color: #111827;
    outline: none;
  }

  .field input::placeholder {
    color: #6b7280;
  }

  .field input::-webkit-search-cancel-button {
    display: none;
  }

  .clear {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    color: #6b7280;
  }

  .clear-all {
    height: 28px;
    padding: 0 8px;
    margin-right: -8px;
    border-radius: 6px;
    font-weight: 500;
    color: #206f52;
  }

  .clear-all:disabled {
    color: #9ca3af;
  }

  .scroll {
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-bottom: 12px;
  }

  .qrow {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    height: 100%;
    padding: 0 4px 0 8px;
    border-radius: 10px;
  }

  .qrow.now {
    background: #e8f8f1;
  }

  .qrow > :not(.hit, .more) {
    pointer-events: none;
  }

  .hit {
    position: absolute;
    inset: 0;
    z-index: 1;
    border-radius: 10px;
    outline-offset: -2px;
  }

  .more {
    position: relative;
    z-index: 2;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    color: #4b5563;
  }

  .phone .more {
    width: 44px;
    height: 44px;
  }

  .qrow.off :global(.dim) {
    opacity: 0.45;
  }

  .pos {
    display: grid;
    place-items: center;
    width: 28px;
    flex-shrink: 0;
    font-size: 12px;
    color: #6b7280;
  }

  .t,
  .a {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .t {
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
    color: #111827;
  }

  .phone .t {
    font-size: 15px;
    line-height: 22px;
  }

  .now .t {
    color: #206f52;
  }

  .a {
    font-size: 12px;
    line-height: 18px;
    color: #4b5563;
  }

  .phone .a {
    font-size: 13px;
    line-height: 20px;
  }

  @media (hover: hover) and (pointer: fine) {
    .qrow:not(.now):hover {
      background: #f9fafb;
    }

    .more:hover,
    .clear:hover {
      background: #d1f1e3;
      color: #1a5b43;
    }
  }
</style>
