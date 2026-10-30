<!--
  歌单格子（#75）：封面、歌单名、首数（隐私加锁，别人的写是谁的）。grid 是封面网格，row 是排序时的一行，
  nav 是歌单页左栏的一行（和 row 同一种画法，整行是链接：当前这张薄荷玻璃底，播放队列里现在这首从它放的就在右边画三根小竖条）。
  搜索结果综合里（collectable）封面右下角压一个始终可见的小圆：自建和我喜欢的标“自建”，别的是收藏开关（CollectButton 的 corner），
  和链接并排放在同一格、不嵌在链接里；曲库网格和歌手页的专辑没有这个按钮。
-->
<script lang='ts'>
  import { resolve } from '$app/paths'
  import { Lock } from '@lucide/svelte'

  import { getAppView } from '../shared/app-context.svelte'
  import { formatSongCount, langOf } from '../shared/text'
  import NowBars from '../songs/NowBars.svelte'
  import Cover from '../ui/Cover.svelte'
  import Tag from '../ui/Tag.svelte'
  import { collectState } from './collect'
  import CollectButton from './CollectButton.svelte'
  import { ROW_COVER_SIZE, TILE_COVER_SIZE } from './tile-grid'

  interface Props {
    id: number
    /** 显示用的名字（playlistName） */
    name: string
    coverUrl: string | null
    /** 网易云没给首数时是 null，“N 首”不显示（#78） */
    trackCount: number | null
    /** 别人的歌单写是谁的；自己的不写，是 null */
    creator: string | null
    locked?: boolean
    phone?: boolean
    onkeydown?: (event: KeyboardEvent) => void
    collectable?: boolean
    /** grid 封面网格；row 排序时的一行；nav 歌单页左栏的一行 */
    look?: 'grid' | 'row' | 'nav'
    current?: boolean
    /** 播放队列里现在这首是从这张歌单放的（只有 nav 画出来） */
    now?: boolean
  }

  const { id, name, coverUrl, trackCount, creator, locked = false, phone = false, onkeydown, collectable = false, look = 'grid', current = false, now = false }: Props = $props()
  const view = getAppView()
  const library = $derived(view.state.library)
  const status = $derived(collectable && library
    ? collectState(library, { kind: 'playlist', id })
    : null)
  const songCount = $derived(formatSongCount(trackCount))
</script>

{#snippet rowBody()}
  <Cover url={coverUrl} size={ROW_COVER_SIZE} class='rounded-md' />
  <span class='min-w-0 flex-1'>
    <span class={[
      'block truncate text-label font-500',
      current ? 'text-primary-950' : 'text-neutral-900',
    ]} lang={langOf(name)}>{name}</span>
    {#if songCount !== null || locked}
      <span class={[
        'mt-0.5 flex items-center gap-1 text-caption',
        current ? 'text-primary-900' : 'text-neutral-600',
      ]}>
        {#if songCount !== null}<span class='flex-none tabular-nums'>{songCount}</span>{/if}
        {#if locked}
          <Lock size={12} class='flex-none' aria-hidden='true' /><span class='sr-only'>隐私歌单</span>
        {/if}
      </span>
    {/if}
  </span>
{/snippet}

{#if look === 'nav'}
  <a
    href={resolve('/playlists/[id=neteaseId]', { id })}
    class={[
      'h-14 flex items-center gap-3 rounded-lg px-2 transition-colors duration-feedback',
      current ? 'bg-primary-200' : 'mouse:hover:bg-primary-100',
    ]}
    aria-current={current ? 'page' : undefined}
    {onkeydown}
  >
    {@render rowBody()}
    {#if now}<NowBars /><span class='sr-only'>正在播放</span>{/if}
  </a>
{:else if look === 'row'}
  <div class='relative min-w-0 flex flex-1 items-center gap-3'>
    <a href={resolve('/playlists/[id=neteaseId]', { id })} class='min-w-0 flex flex-1 items-center gap-3 rounded-lg' {onkeydown}>
      {@render rowBody()}
    </a>
  </div>
{:else}
  <div class='relative min-w-0'>
    <a href={resolve('/playlists/[id=neteaseId]', { id })} class='group block min-w-0 rounded-lg' {onkeydown}>
      <Cover url={coverUrl} size={TILE_COVER_SIZE} fluid class='rounded-lg shadow-ambient transition-[filter] duration-feedback mouse:group-hover:brightness-95' />
      <span class={[
        'mt-2.5 block truncate text-neutral-900 font-500',
        phone ? 'text-body' : 'text-label',
      ]} lang={langOf(name)}>{name}</span>
      {#if songCount !== null || locked || creator}
        <span class='mt-0.5 min-w-0 flex items-center gap-1 text-caption text-neutral-600'>
          {#if songCount !== null}<span class='flex-none tabular-nums'>{songCount}</span>{/if}
          {#if locked}
            <Lock size={12} class='flex-none' aria-hidden='true' /><span class='sr-only'>隐私歌单</span>
          {/if}
          {#if creator}
            <span class='truncate' lang={langOf(creator)}>{songCount !== null || locked
              ? `· ${creator}`
              : creator}</span>
          {/if}
        </span>
      {/if}
    </a>
    {#if collectable && status}
      <!-- 和封面图一样大的一格（自己不挡点击），收藏小圆或“自建”压在它的右下角 -->
      <div class='pointer-events-none absolute inset-x-0 top-0 aspect-square'>
        {#if status === 'own'}
          <span class='absolute bottom-2 right-2'><Tag>自建</Tag></span>
        {:else}
          <CollectButton target={{ kind: 'playlist', id }} {name} look='corner' class='pointer-events-auto absolute bottom-2 right-2' />
        {/if}
      </div>
    {/if}
  </div>
{/if}
