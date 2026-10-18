<!--
  一张专辑的格子：方形圆角封面、专辑名、下面一行灰字（收藏的专辑写歌手，歌手页的专辑写年份，搜索结果写“歌手 · 年份”）。点开是专辑页。
  曲库的专辑标签、桌面首页的专辑架子、歌手页的专辑、搜索结果都用它。歌手名太长时截断歌手，年份照样看得见
-->
<script lang='ts'>
  import { resolve } from '$app/paths'
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
  }

  const { id, name, coverUrl, detail, year = null, phone = false }: Props = $props()
  /** 封面代表点开的那一页（Cover 的 flight）；链接上照样直接写 resolve()，lint 认不出 $derived 里的 */
  const page = $derived(resolve('/albums/[id]', { id: String(id) }))
</script>

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
