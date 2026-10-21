<!-- 已下载（#38）：登录后从桌面侧栏、手机的设置页进来，没登录时从登录页进来（+layout.svelte 换成 SignedOutFrame），是同一页 -->
<script lang='ts'>
  import DownloadsPage from '#lib/components/downloads/DownloadsPage.svelte'
  import { scrollSnapshot } from '#lib/components/snapshot.js'

  /** 已下载里的搜索词 */
  let query = $state('')
  export const snapshot = scrollSnapshot(() => query, (value) => {
    query = value
  })
</script>

<svelte:head><title>已下载 · Campanula</title></svelte:head>

<DownloadsPage bind:query />
