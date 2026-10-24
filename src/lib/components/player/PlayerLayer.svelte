<!--
  播放页层：两个外框（SignedInFrame、SignedOutFrame）都只放这一块。
  负责“队列非空 × 浮层栈里播放页开着 × 抽屉可见”的推导和抽屉的 settle（player-layer.svelte.ts），
  挂播放页和播放提示；改曲库和下载的提示由外框传进来，跟播放提示一起被盖在上面的弹窗 inert。
  先画播放页、后画提示：同 z-50 下提示浮在播放页之上（作者 2026-10-24 定；基线相反，别调换——基线会让提示被不透明播放页盖住却仍可 Tab 聚焦）。
  data-overlay 给浮层栈找这一层的按钮（焦点兜底），和以前经浮层宿主挂载时一样。
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
