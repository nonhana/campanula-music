<!--
  歌单网格里的一格：封面、歌单名、首数（隐私歌单加一把锁，别人的歌单写是谁的）。点开是歌单页。
  曲库的歌单网格、搜索结果的综合都用它
-->
<script lang='ts'>
  import { resolve } from '$app/paths'
  import { Lock } from '@lucide/svelte'
  import Cover from './Cover.svelte'
  import { FLIGHT_COVER_SIZE, formatCount, langOf } from './view'

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
  }

  const { id, name, coverUrl, trackCount, creator, locked = false, phone = false, onkeydown }: Props = $props()
  /** 封面代表点开的那一页（Cover 的 flight）；链接上照样直接写 resolve()，lint 认不出 $derived 里的 */
  const page = $derived(resolve('/playlists/[id=neteaseId]', { id }))
</script>

<a href={resolve('/playlists/[id=neteaseId]', { id })} class='group block min-w-0 rounded-lg' {onkeydown}>
  <Cover url={coverUrl} size={FLIGHT_COVER_SIZE} fluid flight={page} class='rounded-lg shadow-ambient transition-[filter] duration-feedback mouse:group-hover:brightness-95' />
  <span class={['mt-2.5 block truncate text-neutral-900 font-500', phone ? 'text-body' : 'text-label']} lang={langOf(name)}>{name}</span>
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
