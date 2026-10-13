<!-- 音量滑杆：扁平细线，已走过的部分薄荷、滑块森林绿。原生滑杆，键盘 ←/→、Home / End 都能调 -->
<script lang='ts'>
  import type { ClassValue } from 'svelte/elements'
  import { getAppView } from '../app-context.svelte'

  const { class: klass }: { class?: ClassValue } = $props()
  const view = getAppView()
  const volume = $derived(view.state.player.volume)
</script>

<input
  type='range'
  min='0'
  max='1'
  step='0.01'
  value={volume}
  aria-label='音量'
  aria-valuetext='{Math.round(volume * 100)}%'
  class={['slider', klass]}
  style:--filled='{volume * 100}%'
  oninput={event => view.app.setVolume(Number(event.currentTarget.value))}
/>

<style>
  .slider {
    --track: 3px;
    --thumb: 12px;
    appearance: none;
    display: block;
    height: 20px;
    margin: 0;
    background: transparent;
    cursor: pointer;
  }

  .slider::-webkit-slider-runnable-track {
    height: var(--track);
    border-radius: 999px;
    background: linear-gradient(90deg, theme('colors.primary.800') var(--filled), theme('colors.primary.200') var(--filled));
  }

  .slider::-moz-range-track {
    height: var(--track);
    border-radius: 999px;
    background: linear-gradient(90deg, theme('colors.primary.800') var(--filled), theme('colors.primary.200') var(--filled));
  }

  .slider::-webkit-slider-thumb {
    appearance: none;
    width: var(--thumb);
    height: var(--thumb);
    margin-top: calc((var(--track) - var(--thumb)) / 2);
    border: 0;
    border-radius: 50%;
    background: theme('colors.primary.900');
    box-shadow: 0 1px 3px rgb(17 24 39 / 0.18);
  }

  .slider::-moz-range-thumb {
    width: var(--thumb);
    height: var(--thumb);
    border: 0;
    border-radius: 50%;
    background: theme('colors.primary.900');
    box-shadow: 0 1px 3px rgb(17 24 39 / 0.18);
  }

  .slider:focus-visible {
    outline-offset: 4px;
    border-radius: 6px;
  }
</style>
