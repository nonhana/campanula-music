<!--
  歌曲行里点歌的按钮（DESIGN.md Song Row）：盖住整行，单击（轻点）整行就播放。放在 position: relative 的行里。
  给了 cover（这一行的封面）的，点了换歌时封面飞进播放条（player/cover-flight.svelte.ts）；播放队列里的不给，在播放页里换碟。
  键盘焦点环画在行内，不压到相邻的行（DESIGN.md Buttons · Focus）。无版权的歌不能点
-->
<script lang='ts'>
  import type { Snippet } from 'svelte'
  import type { ClassValue } from 'svelte/elements'
  import { getAppView } from '../app-context.svelte'
  import { pick } from '../player/cover-flight.svelte'

  interface Props {
    disabled: boolean
    /** 正在播放这首 */
    now: boolean
    onplay: () => void
    /** 多选：整行是一个勾选框，点了只勾选、不播放，也不飞封面 */
    selecting?: boolean
    selected?: boolean
    /** 桌面不进多选时的 ⌘/Ctrl 点选、Shift 连选 */
    onselect?: (event: MouseEvent) => void
    /** 无版权：普通点按不播放，但多选、⌘/Ctrl 点选照样能勾 */
    unplayable?: boolean
    /** 这一行的封面：点了换歌时它飞进播放条 */
    cover?: HTMLElement
    /** 行是圆角的（白色面板里） */
    rounded?: boolean
    class?: ClassValue
    children: Snippet
  }

  const { disabled, now, onplay, selecting = false, selected = false, onselect, unplayable = false, cover, rounded = false, class: klass, children }: Props = $props()
  const view = getAppView()

  function activate(event: MouseEvent): void {
    // 两种入口（点“多选”、⌘/Ctrl 点选）共用同一个勾选状态：手动多选里 Shift 也要连选
    if (onselect && (event.metaKey || event.ctrlKey || event.shiftKey)) {
      event.preventDefault()
      onselect(event)
      return
    }
    if (selecting) {
      onplay()
      return
    }
    if (unplayable)
      return
    pick(view, onplay, cover)
  }
</script>

<button
  type='button'
  class={['play-target text-left', rounded && 'rounded', klass]}
  {disabled}
  aria-disabled={unplayable && !selecting ? 'true' : undefined}
  role={selecting ? 'checkbox' : undefined}
  aria-checked={selecting ? selected : undefined}
  data-select-row={selecting ? '' : undefined}
  aria-current={now ? 'true' : undefined}
  onclick={activate}
>
  {@render children()}
</button>

<style>
  .play-target::after {
    content: '';
    position: absolute;
    inset: 0;
  }

  .play-target.rounded::after {
    border-radius: 12px;
  }

  .play-target:not(:disabled):active::after {
    background: rgb(17 24 39 / 0.04);
  }

  .play-target:focus-visible {
    outline: none;
  }

  .play-target:focus-visible::after {
    outline: 2px solid theme('colors.primary.800');
    outline-offset: -2px;
  }

  .play-target:disabled {
    cursor: not-allowed;
  }
</style>
