<script lang="ts">
  import { progressOf } from '../player/now';
  import { getAppView } from '../shared/app-context.svelte';
  import { fade } from '../shared/motion';
  import { DURATIONS } from '../shared/motion-tokens';

  interface Props {
    start: number;
    surface?: 'paper' | 'ground' | 'tint';
  }

  const { start, surface = 'paper' }: Props = $props();
  const view = getAppView();
  const progress = $derived(progressOf(view.state.player));
</script>

<span
  class={['wash', surface]}
  style:--start="{start}px"
  aria-hidden="true"
  in:fade
  out:fade={{ duration: DURATIONS['wash-out'] }}
>
  <span class="light" style:--wash-progress={progress}></span>
</span>

<style>
  .wash {
    --tone: theme('colors.primary.100');
    position: absolute;
    inset: 0;
    overflow: hidden;
    border-radius: inherit;
    pointer-events: none;
  }

  .wash.ground {
    --tone: theme('colors.primary.200');
  }

  .wash.tint {
    --tone: theme('colors.primary.300');
    background: theme('colors.primary.200');
  }

  /* 注册成数字才能过渡；注册名是全局的，别处不要重名 */
  @property --wash-progress {
    syntax: '<number>';
    inherits: false;
    initial-value: 0;
  }

  .light {
    position: absolute;
    inset: 0 0 0 var(--start);
    background: linear-gradient(
      90deg,
      var(--tone) calc(var(--wash-progress) * 100% - 40px),
      transparent calc(var(--wash-progress) * 100%)
    );
    mask-image: linear-gradient(90deg, transparent 0, #000 16px);
    transition: --wash-progress var(--move-morning-row) linear;
  }
</style>
