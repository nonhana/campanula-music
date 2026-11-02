<!--
  分段条（DESIGN.md Chips · Segmented）：一行等宽的几格，选中的那格下面垫一块滑块，换选中时滑块横着滑过去（面板 360ms）。
  文字外观（look='text'，歌手页的排法）：没有轨道和滑块，一行文字，选中的墨色 600，其余石墨淡，格之间一根细竖线，每格 44px 高；放在标签条那一行里，比标签低一级。
  role：radio 是单选组（radiogroup / radio / aria-checked）；tab 是标签页（tablist / tab / aria-selected，
  每格的 id 是 `${id}-${key}-tab`，aria-controls 指向 `${id}-${key}`，tabpanel 由调用方画）。
  键盘：←/→（单选组还有 ↑/↓）换格并选中、到头绕回，Home / End 到头；焦点跟着走，Tab 只停在选中的那一格。
-->
<script lang='ts' generics='K extends string'>
  import { tick } from 'svelte'
  import type { ClassValue } from 'svelte/elements'

  interface Props {
    options: readonly { key: K, label: string }[]
    value: K
    onchange: (key: K) => void
    role: 'radio' | 'tab'
    /** 每格是 `${id}-${key}-tab` */
    id: string
    /** 给了 labelledby 就不用 */
    label?: string
    labelledby?: string
    describedby?: string
    class?: ClassValue
    /** track：晨光底的轨道加滑块（默认）；text：一行文字，没有轨道 */
    look?: 'track' | 'text'
  }

  const { options, value, onchange, role, id, label, labelledby, describedby, class: klass, look = 'track' }: Props = $props()

  let group = $state<HTMLElement>()
  const index = $derived(options.findIndex(option => option.key === value))

  const STEPS: Record<string, (at: number, last: number) => number> = {
    ArrowRight: at => at + 1,
    ArrowLeft: at => at - 1,
    Home: () => 0,
    End: (_, last) => last,
  }
  const RADIO_STEPS: Record<string, (at: number) => number> = {
    ArrowDown: at => at + 1,
    ArrowUp: at => at - 1,
  }

  const onkeydown = async (event: KeyboardEvent) => {
    const step = STEPS[event.key] ?? (role === 'radio'
      ? RADIO_STEPS[event.key]
      : undefined)
    if (!step)
      return
    event.preventDefault()
    const count = options.length
    const next = options[(step(index, count - 1) + count) % count]!
    onchange(next.key)
    await tick()
    group?.querySelector<HTMLElement>(`#${CSS.escape(`${id}-${next.key}-tab`)}`)?.focus()
  }
</script>

<div
  bind:this={group}
  class={[
    look === 'track'
      ? 'relative flex rounded-full bg-primary-50 p-1'
      : 'flex items-center',
    klass,
  ]}
  role={role === 'radio'
    ? 'radiogroup'
    : 'tablist'}
  aria-label={label}
  aria-labelledby={labelledby}
  aria-describedby={describedby}
  tabindex='-1'
  {onkeydown}
>
  {#if look === 'track'}
    <span
      class='thumb absolute inset-y-1 left-1 rounded-full bg-primary-200'
      style:width='calc((100% - 8px) / {options.length})'
      style:transform='translateX({index * 100}%)'
      aria-hidden='true'
    ></span>
  {/if}
  {#each options as option, i (option.key)}
    {@const on = option.key === value}
    {#if look === 'text' && i > 0}
      <span class='h-3 w-px flex-none bg-neutral-300' aria-hidden='true'></span>
    {/if}
    <button
      type='button'
      id='{id}-{option.key}-tab'
      {role}
      aria-checked={role === 'radio'
        ? on
        : undefined}
      aria-selected={role === 'tab'
        ? on
        : undefined}
      aria-controls={role === 'tab'
        ? `${id}-${option.key}`
        : undefined}
      tabindex={on
        ? 0
        : -1}
      class={look === 'track'
        ? [
          'relative min-w-0 flex-1 basis-0 whitespace-nowrap rounded-full text-label font-500 transition-colors duration-state',
          on ? 'text-primary-950' : 'text-neutral-600 mouse:hover:text-neutral-900',
        ]
        : [
          'h-11 flex-none whitespace-nowrap rounded-lg px-2 text-label transition-colors duration-state',
          on ? 'text-neutral-900 font-600' : 'text-neutral-500 font-500 mouse:hover:text-neutral-800',
        ]}
      onclick={() => onchange(option.key)}
    >{option.label}</button>
  {/each}
</div>

<style>
  .thumb {
    transition: transform var(--move-panel) var(--ease-out-soft);
  }
</style>
