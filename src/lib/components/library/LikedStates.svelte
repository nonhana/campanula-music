<!--
  我喜欢的音乐还没有歌时的三种样子：加载中（骨架行）、空、出错（可以重试）。有歌时由调用方画列表。
-->
<script lang='ts'>
  import type { SongsView } from './view'
  import { Heart } from '@lucide/svelte'
  import { getAppView } from '../app-context.svelte'
  import { failureText } from '../failure'
  import StateBlock from '../ui/StateBlock.svelte'
  import SkeletonRows from './SkeletonRows.svelte'

  interface Props {
    liked: Exclude<SongsView, { kind: 'songs' }>
    /** 骨架几行 */
    rows: number
    phone?: boolean
  }

  const { liked, rows, phone = false }: Props = $props()
  const view = getAppView()
</script>

{#if liked.kind === 'loading'}
  <SkeletonRows count={rows} {phone} label='正在加载我喜欢的音乐' />
{:else if liked.kind === 'empty'}
  <StateBlock kind='empty' icon={Heart} title='还没有红心的歌' body='在网易云音乐里红心的歌，会同步到这里。' />
{:else}
  <StateBlock kind='error' title='我喜欢的音乐没能同步' body={failureText(liked.failure)} action={{ label: '重试', run: () => view.app.retrySync() }} />
{/if}
