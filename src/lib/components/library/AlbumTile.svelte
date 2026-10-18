<!--
  一张专辑的格子：方形圆角封面、专辑名、下面一行灰字（收藏的专辑写歌手，歌手页的专辑写年份，搜索结果写“歌手 · 年份”）。点开是专辑页。
  曲库的专辑标签、桌面首页的专辑架子、歌手页的专辑、搜索结果都用它。歌手名太长时截断歌手，年份照样看得见。
  搜索结果里（collectable）封面右下角压一个始终可见的收藏小圆（CollectButton 的 corner）：和链接并排放在同一格里，不嵌在链接里
-->
<script lang='ts'>
  import { resolve } from '$app/paths'
  import CollectButton from './CollectButton.svelte'
  import Cover from './Cover.svelte'
  import { FLIGHT_COVER_SIZE, langOf } from './view'

  interface Props {
    id: number
    name: string
    coverUrl: string
    /** 第二行；没有就不写 */
    detail: string
    /** 第二行最后的发行年份（跟在 detail 后面，不截断）；不写是 null */
    year?: number | null
    phone?: boolean
    /** 封面右下角放收藏开关（只在搜索结果里） */
    collectable?: boolean
  }

  const { id, name, coverUrl, detail, year = null, phone = false, collectable = false }: Props = $props()
  /** 封面代表点开的那一页（Cover 的 flight）；链接上照样直接写 resolve()，lint 认不出 $derived 里的 */
  const page = $derived(resolve('/albums/[id]', { id: String(id) }))
</script>

<div class='relative min-w-0'>
  <a href={resolve('/albums/[id]', { id: String(id) })} class='group block min-w-0 rounded-lg'>
    <Cover url={coverUrl} size={FLIGHT_COVER_SIZE} fluid flight={page} class='rounded-lg shadow-ambient transition-[filter] duration-feedback mouse:group-hover:brightness-95' />
    <span class={['mt-2.5 block truncate text-neutral-900 font-500', phone ? 'text-body' : 'text-label']} lang={langOf(name)}>{name}</span>
    {#if detail || year !== null}
      <span class='mt-0.5 min-w-0 flex gap-1 text-caption text-neutral-600 tabular-nums'>
        {#if detail}<span class='truncate' lang={langOf(detail)}>{detail}</span>{/if}
        {#if year !== null}<span class='flex-none'>{detail ? `· ${year}` : year}</span>{/if}
      </span>
    {/if}
  </a>
  {#if collectable}
    <!-- 和封面一样大的一格（自己不挡点击），收藏小圆压在它的右下角 -->
    <div class='pointer-events-none absolute inset-x-0 top-0 aspect-square'>
      <CollectButton target={{ kind: 'album', id }} {name} look='corner' class='pointer-events-auto absolute bottom-2 right-2' />
    </div>
  {/if}
</div>
