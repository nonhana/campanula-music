<!--
  播放的提示（一摞里的一条，见 notice/NoticeStack.svelte）：一句话说什么没成、为什么；网络慢是状态，其余是出错，可以关掉。
  手机播放页开着时整摞挪到顶上，不压控制键；换页时和播放条一样原地不动。位置在 NoticeStack，样子在 NoticeCard。
-->
<script lang='ts'>
  import type { PlayerNotice as Notice } from '#lib/app/player.js'

  import NoticeCard from '../notice/NoticeCard.svelte'
  import { getAppView } from '../shared/app-context.svelte'
  import { noticeText } from './view'

  const { playerNotice, phone, edge, moved, onclose = () => view.app.dismissPlayerNotice() }: {
    playerNotice: Notice
    phone: boolean
    edge: 'top' | 'bottom'
    moved: boolean
    /** 设计页的静态示例用：不接 App，自己处理关闭 */
    onclose?: () => void
  } = $props()
  const view = getAppView()
</script>

<NoticeCard
  tone={playerNotice.kind === 'slow'
    ? 'progress'
    : 'error'}
  text={noticeText(playerNotice)}
  {phone}
  {edge}
  {moved}
  name='player-notice'
  {onclose}
/>
