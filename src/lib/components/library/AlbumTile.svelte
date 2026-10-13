<!--
  一张专辑的格子：方形圆角封面、专辑名、下面一行灰字（收藏的专辑写歌手，歌手页的专辑写年份）。点开是专辑页。
  曲库的专辑标签、桌面首页的专辑架子、歌手页的专辑都用它
-->
<script lang='ts'>
  import { resolve } from '$app/paths'
  import Cover from './Cover.svelte'
  import { langOf } from './view'

  interface Props {
    id: number
    name: string
    coverUrl: string
    /** 第二行；没有就不写 */
    detail: string
    phone?: boolean
  }

  const { id, name, coverUrl, detail, phone = false }: Props = $props()
</script>

<a href={resolve('/albums/[id]', { id: String(id) })} class='group block min-w-0 rounded-lg'>
  <Cover url={coverUrl} size={200} fluid class='rounded-lg shadow-ambient transition-[filter] duration-150 mouse:group-hover:brightness-95' />
  <span class={['mt-2.5 block truncate text-neutral-900 font-500', phone ? 'text-body' : 'text-label']} lang={langOf(name)}>{name}</span>
  {#if detail}
    <span class='mt-0.5 block truncate text-caption text-neutral-600 tabular-nums' lang={langOf(detail)}>{detail}</span>
  {/if}
</a>
