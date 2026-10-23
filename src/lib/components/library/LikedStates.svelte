<!--
  桌面首页我喜欢的音乐一首都没有时的两种样子：空、出错。加载中的骨架行和有歌时的歌曲格由调用方画
-->
<script lang='ts'>
  import type { PlaylistPage } from '#lib/app/library.js'
  import { Heart } from '@lucide/svelte'
  import { getAppView } from '../app-context.svelte'
  import { failureText } from '../failure'
  import StateBlock from '../ui/StateBlock.svelte'
  import { likedFailure } from './liked-failure'

  const { page }: { page: PlaylistPage } = $props()
  const view = getAppView()
  const action = $derived(page.failure ? likedFailure(page.failure) : null)

  /** 同步失败重新同步；打开失败再打开这张歌单（拿不到它的资料时退回重新同步） */
  function retry() {
    if (!page.failure)
      return
    if (action?.retry === 'open' && page.info)
      void view.app.openPlaylist(page.info.id)
    else
      view.app.retrySync()
  }
</script>

{#if page.failure && action}
  <StateBlock kind='error' title={action.title} body={failureText(page.failure.failure)} action={{ label: '重试', run: retry }} />
{:else}
  <StateBlock kind='empty' icon={Heart} title='还没有红心的歌' />
{/if}
