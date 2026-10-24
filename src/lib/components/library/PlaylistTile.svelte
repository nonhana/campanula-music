<!--
  歌单格子（#75）：封面图、歌单名、首数（隐私歌单加一把锁，别人的歌单写是谁的）。点开是歌单页。
  grid：曲库、搜索综合的封面网格；row：歌单排序时的一行 / 拖起的那一行；nav：歌单页左栏当前这一张。
  搜索结果的综合里（collectable）封面图右下角压一个始终可见的小圆：自建歌单和我喜欢的音乐标“自建”，
  别的歌单是收藏开关（CollectButton 的 corner）——和 AlbumTile、ArtistTile 一样，和链接并排放在同一格里，不嵌在链接里。
  曲库的网格、歌手页的专辑没有这个按钮。
-->
<script lang='ts'>
  import { resolve } from '$app/paths'
  import { Lock } from '@lucide/svelte'
  import { getAppView } from '../shared/app-context.svelte'
  import { formatCount, langOf } from '../shared/text'
  import Cover from '../ui/Cover.svelte'
  import Tag from '../ui/Tag.svelte'
  import { collectState } from './collect'
  import CollectButton from './CollectButton.svelte'
  import { FLIGHT_COVER_SIZE } from './flight'

  interface Props {
    id: number
    name: string
    coverUrl: string
    trackCount: number
    /** 别人的歌单写是谁的；自己的不写，是 null */
    creator: string | null
    /** 隐私歌单 */
    locked?: boolean
    phone?: boolean
    /** 排序模式里焦点在这一格时的键盘操作（Alt + ↑ / ↓） */
    onkeydown?: (event: KeyboardEvent) => void
    /** 搜索结果里封面图右下角的收藏 / 自建角标 */
    collectable?: boolean
    /** grid：封面网格；row：排序时的一行；nav：歌单页左栏 */
    look?: 'grid' | 'row' | 'nav'
    /** nav：当前打开的这一张 */
    current?: boolean
    /** 这张封面图是不是页面飞行的起点；拖起来的副本同时出现时关掉（同一时刻一个名字只有一个元素） */
    flight?: boolean
  }

  const { id, name, coverUrl, trackCount, creator, locked = false, phone = false, onkeydown, collectable = false, look = 'grid', current = false, flight = true }: Props = $props()
  const view = getAppView()
  const library = $derived(view.state.library)
  const status = $derived(collectable && library
    ? collectState(library, { kind: 'playlist', id })
    : null)
  /** 封面图代表点开的那一页（Cover 的 flight）；链接上照样直接写 resolve()，lint 认不出 $derived 里的 */
  const page = $derived(resolve('/playlists/[id=neteaseId]', { id }))
</script>

{#if look === 'nav'}
  <a
    href={resolve('/playlists/[id=neteaseId]', { id })}
    class={[
      'block rounded-xl p-4 transition-colors duration-feedback',
      current ? 'bg-primary-100' : 'mouse:hover:bg-white',
    ]}
    aria-current={current ? 'page' : undefined}
    {onkeydown}
  >
    <Cover url={coverUrl} size={FLIGHT_COVER_SIZE} fluid flight={flight ? page : undefined} class='rounded-lg' />
    <span class={[
      'mt-2.5 block truncate text-label font-500',
      current ? 'text-primary-950' : 'text-neutral-900',
    ]} lang={langOf(name)}>{name}</span>
    <span class={[
      'mt-0.5 block text-caption tabular-nums',
      current ? 'text-primary-900' : 'text-neutral-600',
    ]}>{formatCount(trackCount)} 首</span>
  </a>
{:else if look === 'row'}
  <div class='relative min-w-0 flex flex-1 items-center gap-3'>
    <a href={resolve('/playlists/[id=neteaseId]', { id })} class='min-w-0 flex flex-1 items-center gap-3 rounded-lg' {onkeydown}>
      <Cover url={coverUrl} size={40} class='rounded-md' />
      <span class='min-w-0 flex-1'>
        <span class='block truncate text-label text-neutral-900 font-500' lang={langOf(name)}>{name}</span>
        <span class='mt-0.5 flex items-center gap-1 text-caption text-neutral-600'>
          <span class='flex-none tabular-nums'>{formatCount(trackCount)} 首</span>
          {#if locked}
            <Lock size={12} class='flex-none' aria-hidden='true' /><span class='sr-only'>隐私歌单</span>
          {/if}
        </span>
      </span>
    </a>
  </div>
{:else}
  <div class='relative min-w-0'>
    <a href={resolve('/playlists/[id=neteaseId]', { id })} class='group block min-w-0 rounded-lg' {onkeydown}>
      <Cover url={coverUrl} size={FLIGHT_COVER_SIZE} fluid flight={flight ? page : undefined} class='rounded-lg shadow-ambient transition-[filter] duration-feedback mouse:group-hover:brightness-95' />
      <span class={[
        'mt-2.5 block truncate text-neutral-900 font-500',
        phone ? 'text-body' : 'text-label',
      ]} lang={langOf(name)}>{name}</span>
      <span class='mt-0.5 min-w-0 flex items-center gap-1 text-caption text-neutral-600'>
        <span class='flex-none tabular-nums'>{formatCount(trackCount)} 首</span>
        {#if locked}
          <Lock size={12} class='flex-none' aria-hidden='true' /><span class='sr-only'>隐私歌单</span>
        {/if}
        {#if creator}
          <span class='truncate' lang={langOf(creator)}>· {creator}</span>
        {/if}
      </span>
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
