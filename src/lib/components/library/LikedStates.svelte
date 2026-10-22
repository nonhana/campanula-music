<!--
  桌面首页我喜欢的音乐一首都没有时的两种样子：空、出错（可以重试）。加载中的骨架行和有歌时的歌曲格由调用方画
-->
<script lang='ts'>
  import type { SongsView } from './view'
  import { Heart } from '@lucide/svelte'
  import { getAppView } from '../app-context.svelte'
  import { failureText } from '../failure'
  import StateBlock from '../ui/StateBlock.svelte'

  const { liked }: { liked: Extract<SongsView, { kind: 'empty' | 'failed' }> } = $props()
  const view = getAppView()
</script>

{#if liked.kind === 'empty'}
  <StateBlock kind='empty' icon={Heart} title='还没有红心的歌' />
{:else}
  <StateBlock kind='error' title='我喜欢的音乐没能同步' body={failureText(liked.failure)} action={{ label: '重试', run: () => view.app.retrySync() }} />
{/if}
