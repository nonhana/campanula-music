<!--
  分段条（DESIGN.md Chips · Segmented）：一行等宽的几格，薄荷晨光底的轨道，选中的那格下面垫一块薄荷玻璃的滑块；
  换选中时滑块横着滑过去（transform，面板 360ms，ease-out-soft；减少动态效果时直接到位），字色跟着淡换（200ms）。
  role：radio 是单选组（设置的音质：radiogroup / radio / aria-checked）；tab 是标签页（登录方式、播放页的 歌词 / 播放队列：
  tablist / tab / aria-selected，每格的 id 是 `${id}-${key}-tab`，aria-controls 指向 `${id}-${key}`，标签页的 tabpanel 由调用方画）。
  键盘：←/→（单选组还有 ↑/↓）换到前一格、后一格并选中，到头了绕回去，Home / End 到第一格、最后一格；焦点跟着走，Tab 只停在选中的那一格。
  手机桌面一样高，调用方用 class 定高度和宽度（h-10 / h-11、w-full、max-w）
-->
<script lang='ts' generics='K extends string'>
  import { tick } from 'svelte'
  import type { ClassValue } from 'svelte/elements'

  interface Props {
    /** 每格的 key 和字 */
    options: readonly { key: K, label: string }[]
    value: K
    onchange: (key: K) => void
    role: 'radio' | 'tab'
    /** 这一组的 id；每格是 `${id}-${key}-tab` */
    id: string
    /** 读屏读出的组名：给了 labelledby 就不用 */
    label?: string
    labelledby?: string
    describedby?: string
    class?: ClassValue
  }

  const { options, value, onchange, role, id, label, labelledby, describedby, class: klass }: Props = $props()

  let group = $state<HTMLElement>()
  const index = $derived(options.findIndex(option => option.key === value))

  /** 方向键跳几格（单选组上下也算），Home / End 到头 */
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
  class={['relative flex rounded-full bg-primary-50 p-1', klass]}
  role={role === 'radio'
    ? 'radiogroup'
    : 'tablist'}
  aria-label={label}
  aria-labelledby={labelledby}
  aria-describedby={describedby}
  tabindex='-1'
  {onkeydown}
>
  <span
    class='thumb absolute inset-y-1 left-1 rounded-full bg-primary-200'
    style:width='calc((100% - 8px) / {options.length})'
    style:transform='translateX({index * 100}%)'
    aria-hidden='true'
  ></span>
  {#each options as option (option.key)}
    {@const on = option.key === value}
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
      class={[
        'relative min-w-0 flex-1 basis-0 whitespace-nowrap rounded-full text-label font-500 transition-colors duration-state',
        on ? 'text-primary-950' : 'text-neutral-600 mouse:hover:text-neutral-900',
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
