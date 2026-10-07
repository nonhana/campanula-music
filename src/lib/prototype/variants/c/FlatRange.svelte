<!-- PROTOTYPE（变体 C）：扁平进度条 / 音量条。轨道 neutral-200，已走过的部分 primary-800，滑块 primary-900。 -->
<script lang='ts'>
  interface Props {
    value: number
    max: number
    label: string
    valueText?: string
    /** 轨道粗细（px） */
    track?: number
    thumb?: number
    oninput: (v: number) => void
    class?: string
  }

  const { value, max, label, valueText, track = 4, thumb = 14, oninput, class: klass = '' }: Props = $props()

  const pct = $derived(max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0)
</script>

<input
  type='range'
  class='flat {klass}'
  min='0'
  {max}
  step='any'
  {value}
  aria-label={label}
  aria-valuetext={valueText}
  style:--p='{pct}%'
  style:--track='{track}px'
  style:--thumb='{thumb}px'
  oninput={e => oninput(Number(e.currentTarget.value))}
/>

<style>
  .flat {
    -webkit-appearance: none;
    appearance: none;
    display: block;
    width: 100%;
    height: calc(var(--thumb) + 10px);
    margin: 0;
    background: transparent;
    cursor: pointer;
  }

  .flat::-webkit-slider-runnable-track {
    height: var(--track);
    border-radius: 999px;
    background: linear-gradient(to right, #2b976f var(--p), #e5e7eb var(--p));
  }

  .flat::-moz-range-track {
    height: var(--track);
    border-radius: 999px;
    background: linear-gradient(to right, #2b976f var(--p), #e5e7eb var(--p));
  }

  .flat::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: var(--thumb);
    height: var(--thumb);
    margin-top: calc((var(--track) - var(--thumb)) / 2);
    border: 2px solid #fff;
    border-radius: 999px;
    background: #206f52;
    box-shadow: 0 1px 3px rgb(17 24 39 / 0.2);
    transition: transform 160ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .flat::-moz-range-thumb {
    width: var(--thumb);
    height: var(--thumb);
    border: 2px solid #fff;
    border-radius: 999px;
    background: #206f52;
    box-shadow: 0 1px 3px rgb(17 24 39 / 0.2);
  }

  .flat:focus-visible {
    outline-offset: 0;
    border-radius: 6px;
  }

  .flat:active::-webkit-slider-thumb {
    transform: scale(1.15);
  }
</style>
