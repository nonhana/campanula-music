<!--
  曲库的歌单、专辑、歌手页的页头（作者 2026-11-01 定）：桌面是 Headline 标题、数量和右边的筛选框（最宽 280px），筛选时数量换成“找到 N 张 / 位”（淡入）；
  手机在曲库的文字标签下面，没有标题，只有筛选框，找到几个只给读屏。筛的是本机已有的列表（App 的 searchPlaylists / searchAlbums / searchArtists），不发请求。
-->
<script lang='ts'>
  import { fade } from '../shared/motion'
  import { formatCount } from '../shared/text'
  import SearchField from '../ui/SearchField.svelte'

  interface Props {
    /** 歌单 / 专辑 / 歌手：页面的 h1；筛选框叫“筛选…” */
    title: string
    unit: '张' | '位'
    /** 一共几个；列表还没同步到时是 null，不写数量 */
    total: number | null
    /** 筛到几个；没在筛选时是 null */
    found: number | null
    query: string
    /** 歌单页排序时变灰 */
    disabled?: boolean
    phone?: boolean
  }

  let { title, unit, total, found, query = $bindable(), disabled = false, phone = false }: Props = $props()
  const label = $derived(`筛选${title}`)
</script>

{#if phone}
  <div class='px-4 pt-3'>
    <SearchField {label} bind:value={query} {disabled} />
    <p class='sr-only' role='status'>{found === null
      ? ''
      : `找到 ${formatCount(found)} ${unit}`}</p>
  </div>
{:else}
  <div class='mb-4 mt-6 flex items-center gap-3'>
    <h1 class='text-headline text-neutral-900 font-600'>{title}</h1>
    <!-- 数量跟着列表、筛选结果出现：换成另一种写法时淡入，接着打字时数字原地换 -->
    <span class='text-caption text-neutral-500 tabular-nums' role='status'>
      {#if found !== null}
        <span in:fade>找到 {formatCount(found)} {unit}</span>
      {:else if total !== null}
        <span in:fade>{formatCount(total)} {unit}</span>
      {/if}
    </span>
    <SearchField {label} bind:value={query} {disabled} class='ml-auto max-w-[280px] min-w-[128px] w-full' />
  </div>
{/if}
