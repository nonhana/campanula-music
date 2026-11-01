<!--
  一张专辑的格子：方形圆角封面、专辑名、下面一行灰字（收藏的写歌手，歌手页的写年份，搜索写“歌手 · 年份”）。曲库的专辑标签、
  桌面首页的架子、歌手页的专辑、搜索结果都用它；歌手名太长时截断歌手、年份照样看得见。搜索结果里（collectable）封面右下角压一个
  收藏小圆（CollectButton 的 corner），和链接并排放在同一格、不嵌在链接里。
-->
<script lang='ts'>
  import { resolve } from '$app/paths'

  import { langOf } from '../shared/text'
  import Cover from '../ui/Cover.svelte'
  import CollectButton from './CollectButton.svelte'
  import { FLIGHT_COVER_SIZE } from './flight'

  interface Props {
    id: number
    /** 网易云没给专辑名时是 null，这一行不显示（#78） */
    name: string | null
    coverUrl: string | null
    detail: string
    /** 跟在 detail 后面，不截断；不写是 null */
    year?: number | null
    phone?: boolean
    collectable?: boolean
  }

  const { id, name, coverUrl, detail, year = null, phone = false, collectable = false }: Props = $props()
  /** 链接上照样直接写 resolve()，lint 认不出 $derived 里的 */
  const page = $derived(resolve('/albums/[id=neteaseId]', { id }))
</script>

<div class='relative min-w-0'>
  <a href={resolve('/albums/[id=neteaseId]', { id })} class='group block min-w-0 rounded-lg'>
    <Cover url={coverUrl} size={FLIGHT_COVER_SIZE} fluid flight={page} class='rounded-lg shadow-ambient transition-[filter] duration-feedback mouse:group-hover:brightness-95' />
    {#if name !== null}
      <span class={[
        'mt-2.5 block truncate text-neutral-900 font-500',
        phone ? 'text-body' : 'text-label',
      ]} lang={langOf(name)}>{name}</span>
    {/if}
    {#if detail || year !== null}
      <span class={[
        'min-w-0 flex gap-1 text-caption text-neutral-600 tabular-nums',
        name === null
          ? 'mt-2.5'
          : 'mt-0.5',
      ]}>
        {#if detail}<span class='truncate' lang={langOf(detail)}>{detail}</span>{/if}
        {#if year !== null}<span class='flex-none'>{detail
          ? `· ${year}`
          : year}</span>{/if}
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
