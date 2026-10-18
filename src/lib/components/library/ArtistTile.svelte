<!--
  一位歌手的格子：圆形头像、名字居中，下面可以有一行灰字（搜索结果写单曲数）。点开是歌手页。
  曲库的歌手标签、桌面首页的歌手架子、搜索结果都用它；没有头像的歌手显示人像图标
-->
<script lang='ts'>
  import { resolve } from '$app/paths'
  import { UserRound } from '@lucide/svelte'
  import Cover from './Cover.svelte'
  import { FLIGHT_COVER_SIZE, langOf } from './view'

  interface Props {
    id: number
    name: string
    /** 没有头像时是 null */
    avatarUrl: string | null
    /** 名字下面的一行；不给就不写 */
    detail?: string
  }

  const { id, name, avatarUrl, detail = '' }: Props = $props()
  /** 头像代表点开的那一页（Cover 的 flight）；链接上照样直接写 resolve()，lint 认不出 $derived 里的 */
  const page = $derived(resolve('/artists/[id]', { id: String(id) }))
</script>

<a href={resolve('/artists/[id]', { id: String(id) })} class='group block min-w-0 rounded-lg text-center'>
  <Cover url={avatarUrl} size={FLIGHT_COVER_SIZE} fluid flight={page} fallback={UserRound} class='rounded-full shadow-ambient transition-[filter] duration-feedback mouse:group-hover:brightness-95' />
  <span class='mt-2.5 block truncate text-label text-neutral-900 font-500' lang={langOf(name)}>{name}</span>
  {#if detail}
    <span class='mt-0.5 block truncate text-caption text-neutral-600 tabular-nums'>{detail}</span>
  {/if}
</a>
