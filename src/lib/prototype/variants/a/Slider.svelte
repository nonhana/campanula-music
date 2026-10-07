<!-- PROTOTYPE：扁平细线滑杆（播放进度、音量）。已走过的部分薄荷 800，滑块薄荷 900。 -->
<script lang='ts'>
  interface Props {
    value: number
    max: number
    label: string
    valueText?: string
    step?: number
    size?: 'md' | 'sm'
    onchange: (v: number) => void
    class?: string
  }

  const { value, max, label, valueText, step = 1, size = 'md', onchange, class: klass = '' }: Props = $props()

  const pct = $derived(max > 0 ? Math.min(100, (value / max) * 100) : 0)
</script>

<input
  type='range'
  min='0'
  {max}
  {step}
  {value}
  aria-label={label}
  aria-valuetext={valueText}
  class={['slider', size, klass]}
  style:--p='{pct}%'
  oninput={e => onchange(Number(e.currentTarget.value))}
/>

<style>
  .slider {
    --track: 4px;
    --thumb: 14px;
    appearance: none;
    -webkit-appearance: none;
    display: block;
    width: 100%;
    height: 20px;
    margin: 0;
    background: transparent;
    cursor: pointer;
  }

  .slider.sm {
    --track: 3px;
    --thumb: 12px;
  }

  .slider::-webkit-slider-runnable-track {
    height: var(--track);
    border-radius: 999px;
    background: linear-gradient(90deg, #2b976f var(--p), #d1f1e3 var(--p));
  }

  .slider::-moz-range-track {
    height: var(--track);
    border-radius: 999px;
    background: linear-gradient(90deg, #2b976f var(--p), #d1f1e3 var(--p));
  }

  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: var(--thumb);
    height: var(--thumb);
    margin-top: calc((var(--track) - var(--thumb)) / 2);
    border: 0;
    border-radius: 50%;
    background: #206f52;
    box-shadow: 0 1px 3px rgb(17 24 39 / 0.18);
    transition: transform 160ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .slider::-moz-range-thumb {
    width: var(--thumb);
    height: var(--thumb);
    border: 0;
    border-radius: 50%;
    background: #206f52;
    box-shadow: 0 1px 3px rgb(17 24 39 / 0.18);
  }

  .slider:focus-visible {
    outline-offset: 4px;
    border-radius: 6px;
  }

  @media (hover: hover) and (pointer: fine) {
    .slider:hover::-webkit-slider-thumb {
      transform: scale(1.18);
    }
  }
</style>
