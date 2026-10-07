<!-- PROTOTYPE（变体 C）：即时搜索的内容。有搜索词时分组列出结果，没有时显示搜索历史。桌面下拉面板和手机全屏搜索共用。 -->
<script lang='ts'>
  import type { Snippet } from 'svelte'
  import type { ResultItem, Results } from './results'
  import { ArrowRight, AudioLines, Globe } from '@lucide/svelte'
  import Cover from '$lib/prototype/Cover.svelte'
  import { artistLine, formatCount, formatDuration, langOf } from '$lib/prototype/data'
  import { nav } from '$lib/prototype/nav.svelte'
  import { player } from '$lib/prototype/player.svelte'
  import Hl from './Hl.svelte'
  import { itemKey, TOP_SONGS } from './results'
  import { hasHit } from './search'
  import { ui } from './ui.svelte'

  interface Props {
    results: Results
    /** 键盘高亮的那一项（items 的下标） */
    active?: number
    idPrefix: string
    phone?: boolean
    onpick: (item: ResultItem) => void
  }

  const { results, active = -1, idPrefix, phone = false, onpick }: Props = $props()

  const q = $derived(results.query)
  const shown = $derived(results.query.trim())

  function optId(item: ResultItem) {
    return `${idPrefix}-${itemKey(item)}`
  }

  function isActive(item: ResultItem) {
    return active >= 0 && results.items[active] === item
  }

  const songItems = $derived(results.items.filter(i => i.kind === 'song'))
  const plItems = $derived(results.items.filter(i => i.kind === 'playlist'))
  const arItems = $derived(results.items.filter(i => i.kind === 'artist'))
  const cloudItem = $derived(results.items.find(i => i.kind === 'cloud'))
  const allItem = $derived(results.items.find(i => i.kind === 'all'))
</script>

{#snippet option(item: ResultItem, body: Snippet)}
  <div
    id={optId(item)}
    role='option'
    tabindex='-1'
    aria-selected={isActive(item)}
    class='opt'
    class:phone
    class:active={isActive(item)}
    onmousedown={e => e.preventDefault()}
    onclick={() => onpick(item)}
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onpick(item)
      }
    }}
  >
    {@render body()}
  </div>
{/snippet}

{#if shown === ''}
  <div class='history' class:px-4={phone} class:px-5={!phone}>
    <div class='flex items-baseline gap-3'>
      <h2 class='text-[13px] text-neutral-900 font-500 leading-5'>搜索历史</h2>
      <span class='text-xs text-neutral-500'>仅保存在本机</span>
      {#if ui.history.length > 0}
        <button
          type='button'
          class='clear-btn ml-auto text-[13px] text-primary-900 font-500'
          onmousedown={e => e.preventDefault()}
          onclick={() => (ui.history = [])}
        >清空</button>
      {/if}
    </div>
    {#if ui.history.length > 0}
      <ul class='mt-3 flex flex-wrap gap-2' aria-label='搜索历史'>
        {#each ui.history as h (h)}
          <li>
            <button
              type='button'
              lang={langOf(h)}
              class='chip'
              class:phone
              onmousedown={e => e.preventDefault()}
              onclick={() => (nav.query = h)}
            >{h}</button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class='mt-3 text-[13px] text-neutral-500'>还没有搜索历史。</p>
    {/if}
    <p class='mt-4 text-xs text-neutral-500 leading-[18px]'>
      歌名、歌手、专辑都能搜；平假名和片假名、大小写不用区分。曲库在这台设备上，边打字边出结果。
    </p>
  </div>
{:else}
  <div role='listbox' id='{idPrefix}-listbox' aria-label='搜索结果'>
    <div class='group-head' class:phone>
      <span>曲库中</span>
      <span class='tnum text-neutral-900' aria-live='polite'>{formatCount(results.songs.length)} 首</span>
    </div>
    {#if songItems.length === 0}
      <p class='empty' class:phone>我喜欢的音乐里没有和“{shown}”匹配的歌曲。</p>
    {/if}
    {#each songItems as item (itemKey(item))}
      {#if item.kind === 'song'}
        {@const s = item.song}
        {@const playing = player.current?.id === s.id}
        {#snippet songBody()}
          <span class='relative shrink-0'>
            <Cover cover={s.cover} class='cover {phone ? 'size-12' : 'size-10'} rounded-lg' />
            {#if playing}
              <span class='absolute inset-0 grid place-items-center rounded-lg bg-[rgb(26_91_67/0.55)] text-white'>
                <AudioLines size={18} strokeWidth={2.25} aria-hidden='true' />
              </span>
            {/if}
          </span>
          <span class='min-w-0 flex-1' class:opacity-45={s.unavailable}>
            <span class='line1' class:text-primary-900={playing} lang={s.lang}><Hl text={s.title} query={q} /></span>
            <span class='line2' lang={s.lang}>
              {#if s.unavailable}<span class='mr-1 text-neutral-700'>无版权 ·</span>{/if}
              <Hl text={artistLine(s)} query={q} /><span class='text-neutral-400'> · </span><Hl text={s.album} query={q} />
            </span>
          </span>
          <span class='tnum shrink-0 text-xs text-neutral-500'>{formatDuration(s.duration)}</span>
        {/snippet}
        {@render option(item, songBody)}
      {/if}
    {/each}
    {#if results.songs.length > TOP_SONGS && phone && allItem}
      {#snippet allBodyPhone()}
        <span class='flex-1 text-sm text-primary-900 font-500'>查看曲库中的全部 {formatCount(results.songs.length)} 首</span>
        <ArrowRight size={18} class='text-primary-900' aria-hidden='true' />
      {/snippet}
      {@render option(allItem, allBodyPhone)}
    {/if}

    {#if plItems.length > 0}
      <div class='group-head' class:phone>
        <span>歌单</span>
        <span class='tnum text-neutral-900'>{plItems.length}</span>
      </div>
      {#each plItems as item (itemKey(item))}
        {#if item.kind === 'playlist'}
          {@const p = item.playlist}
          {#snippet plBody()}
            <Cover cover={p.cover} class='cover {phone ? 'size-12' : 'size-10'} shrink-0 rounded-lg' />
            <span class='min-w-0 flex-1'>
              <span class='line1' lang={langOf(p.name)}><Hl text={p.name} query={q} /></span>
              <span class='line2'>
                {formatCount(p.count)} 首 · {p.kind === 'collected' ? `收藏自 ${p.creator}` : '自建歌单'}{#if !hasHit(p.name, q) && p.description}<span class='text-neutral-400'> · </span><Hl text={p.description} query={q} />{/if}
              </span>
            </span>
          {/snippet}
          {@render option(item, plBody)}
        {/if}
      {/each}
    {/if}

    {#if arItems.length > 0}
      <div class='group-head' class:phone>
        <span>歌手</span>
        <span class='tnum text-neutral-900'>{arItems.length}</span>
      </div>
      {#each arItems as item (itemKey(item))}
        {#if item.kind === 'artist'}
          {@const a = item.artist}
          {#snippet arBody()}
            <Cover cover={a.avatar} class='cover {phone ? 'size-12' : 'size-10'} shrink-0 rounded-full' />
            <span class='min-w-0 flex-1'>
              <span class='line1' lang={langOf(a.name)}><Hl text={a.name} query={q} /></span>
              <span class='line2'>歌手 · 网易云收录 {formatCount(a.songCount)} 首</span>
            </span>
          {/snippet}
          {@render option(item, arBody)}
        {/if}
      {/each}
    {/if}

    {#if cloudItem}
      <div class='sep' class:phone></div>
      {#snippet cloudBody()}
        <span class='grid {phone ? 'size-12' : 'size-10'} shrink-0 place-items-center rounded-lg bg-neutral-100 text-neutral-600'>
          <Globe size={18} aria-hidden='true' />
        </span>
        <span class='min-w-0 flex-1 truncate text-sm text-neutral-900'>
          在网易云中搜索 <span lang={langOf(shown)}>“{shown}”</span>
        </span>
        <ArrowRight size={18} class='shrink-0 text-neutral-500' aria-hidden='true' />
      {/snippet}
      {@render option(cloudItem, cloudBody)}
    {/if}

    {#if allItem && !phone}
      {#snippet allBody()}
        <span class='flex-1 text-sm text-primary-900 font-500'>查看曲库中的全部 {formatCount(results.songs.length)} 首</span>
        <span class='text-xs text-neutral-500'>在我喜欢的音乐里就地过滤</span>
        <ArrowRight size={18} class='text-primary-900' aria-hidden='true' />
      {/snippet}
      <div class='footer'>
        {@render option(allItem, allBody)}
      </div>
    {/if}
  </div>
{/if}

<style>
  .history {
    padding-top: 16px;
    padding-bottom: 16px;
  }

  .chip {
    height: 32px;
    padding: 0 12px;
    border-radius: 8px;
    background: #f3f4f6;
    color: #374151;
    font-size: 13px;
    line-height: 32px;
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chip.phone {
    height: 40px;
    line-height: 40px;
    padding: 0 14px;
    font-size: 14px;
  }

  .group-head {
    display: flex;
    align-items: baseline;
    gap: 6px;
    padding: 14px 20px 6px;
    font-size: 12px;
    font-weight: 500;
    line-height: 16px;
    color: #4b5563;
  }

  .group-head.phone {
    padding: 18px 16px 6px;
    font-size: 13px;
  }

  .empty {
    padding: 6px 20px 10px;
    font-size: 13px;
    color: #6b7280;
  }

  .empty.phone {
    padding-inline: 16px;
  }

  .opt {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding: 8px 20px;
    cursor: pointer;
    outline: none;
  }

  .opt.phone {
    min-height: 64px;
    padding: 8px 16px;
    gap: 14px;
  }

  .opt.active {
    background: #f5fcf9;
    box-shadow: inset 2px 0 0 #2b976f;
  }

  .line1 {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
    color: #111827;
  }

  .phone .line1 {
    font-size: 15px;
    line-height: 22px;
  }

  .line2 {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    line-height: 18px;
    color: #4b5563;
  }

  .phone .line2 {
    font-size: 13px;
    line-height: 20px;
  }

  .line1.text-primary-900 {
    color: #206f52;
  }

  .sep {
    height: 1px;
    margin: 8px 20px;
    background: #f3f4f6;
  }

  .sep.phone {
    margin: 8px 16px;
  }

  .footer {
    margin-top: 4px;
    background: #f5fcf9;
  }

  .footer .opt {
    min-height: 48px;
  }

  @media (hover: hover) and (pointer: fine) {
    .opt:hover {
      background: #f5fcf9;
    }

    .footer .opt:hover {
      background: #e8f8f1;
    }

    .chip:hover {
      background: #e8f8f1;
      color: #1a5b43;
    }

    .clear-btn:hover {
      text-decoration: underline;
      text-underline-offset: 3px;
    }
  }
</style>
