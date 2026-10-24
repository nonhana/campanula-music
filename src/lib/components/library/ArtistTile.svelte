<!--
  一位歌手的格子：圆形头像、名字居中，下面可以有一行灰字（搜索结果写单曲数）。点开是歌手页。
  曲库的歌手标签、桌面首页的歌手架子、搜索结果都用它；没有头像的歌手显示人像图标。
  搜索结果里（collectable）头像右下角压一个始终可见的收藏小圆（CollectButton 的 corner），中心落在圆边 45° 的地方：
  和链接并排放在同一格里，不嵌在链接里
-->
<script lang='ts'>
  import { resolve } from '$app/paths'
  import { UserRound } from '@lucide/svelte'
  import { langOf } from '../text'
  import Cover from '../ui/Cover.svelte'
  import CollectButton from './CollectButton.svelte'
  import { FLIGHT_COVER_SIZE } from './flight'

  interface Props {
    id: number
    name: string
    /** 没有头像时是 null */
    avatarUrl: string | null
    /** 名字下面的一行；不给就不写 */
    detail?: string
    /** 头像右下角放收藏开关（只在搜索结果里） */
    collectable?: boolean
  }

  const { id, name, avatarUrl, detail = '', collectable = false }: Props = $props()
  /** 头像代表点开的那一页（Cover 的 flight）；链接上照样直接写 resolve()，lint 认不出 $derived 里的 */
  const page = $derived(resolve('/artists/[id=neteaseId]', { id }))
</script>

<div class='relative min-w-0'>
  <a href={resolve('/artists/[id=neteaseId]', { id })} class='group block min-w-0 rounded-lg text-center'>
    <Cover url={avatarUrl} size={FLIGHT_COVER_SIZE} fluid flight={page} fallback={UserRound} class='rounded-full shadow-ambient transition-[filter] duration-feedback mouse:group-hover:brightness-95' />
    <span class='mt-2.5 block truncate text-label text-neutral-900 font-500' lang={langOf(name)}>{name}</span>
    {#if detail}
      <span class='mt-0.5 block truncate text-caption text-neutral-600 tabular-nums'>{detail}</span>
    {/if}
  </a>
  {#if collectable}
    <!-- 和头像一样大的一格（自己不挡点击）。圆边 45° 的点离右边、下边各 (1 − cos45°)/2 ≈ 14.6%，小圆（32px）的中心放在那里 -->
    <div class='pointer-events-none absolute inset-x-0 top-0 aspect-square'>
      <CollectButton target={{ kind: 'artist', id }} {name} look='corner' class='pointer-events-auto absolute bottom-[calc(14.6%-16px)] right-[calc(14.6%-16px)]' />
    </div>
  {/if}
</div>
