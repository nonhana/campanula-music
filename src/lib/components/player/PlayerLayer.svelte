<!--
  播放页层：两个外框（SignedInFrame、SignedOutFrame）都只放这一块；推导“队列非空 × 栈里播放页开着 × 抽屉可见”和抽屉 settle
  （player-layer.svelte.ts），挂播放页和播放提示；外框传进来的提示跟播放提示一起被上面的弹窗 inert。
  先画播放页、后画提示：同 z-50 下提示浮在播放页之上（作者 2026-10-24 定；基线相反，别调换——基线会让提示被不透明播放页盖住却仍可 Tab 聚焦）。
  data-overlay 给浮层栈找这一层的按钮（焦点兜底）。
-->
<script lang='ts'>
  import type { Snippet } from 'svelte'

  import { getOverlays } from '../overlay/overlay-context'
  import { desktopLayout } from '../shared/layout'
  import PlayerNotice from './PlayerNotice.svelte'
  import PlayerPage from './PlayerPage.svelte'

  const { children }: { children?: Snippet } = $props()
  const { player: layer, playerLayer } = getOverlays()
</script>

<div class='contents' data-overlay='player' inert={layer.containerInert}>
  {#if playerLayer.shown}
    <PlayerPage open={playerLayer.open} />
  {/if}
  <PlayerNotice phone={!desktopLayout.current} overPlayerPage={playerLayer.open} />
  {@render children?.()}
</div>
