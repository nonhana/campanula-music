<!--
  歌曲行里点歌的按钮（DESIGN.md Song Row）：盖住整行，单击（轻点）整行就播放。放在 position: relative 的行里。
  键盘焦点环画在行内，不压到相邻的行（DESIGN.md Buttons · Focus）。无版权的歌不能点
-->
<script lang='ts'>
  import type { Snippet } from 'svelte'
  import type { ClassValue } from 'svelte/elements'

  interface Props {
    disabled: boolean
    /** 正在播放这首 */
    now: boolean
    onplay: () => void
    /** 行是圆角的（白色面板里） */
    rounded?: boolean
    class?: ClassValue
    children: Snippet
  }

  const { disabled, now, onplay, rounded = false, class: klass, children }: Props = $props()
</script>

<button type='button' class={['play-target text-left', rounded && 'rounded', klass]} {disabled} aria-current={now ? 'true' : undefined} onclick={onplay}>
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
