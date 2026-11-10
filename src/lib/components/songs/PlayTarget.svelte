<!-- 按钮里不能放链接：能点的东西都画在外面，用 relative z-1 压在上面 -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { ClassValue } from 'svelte/elements';

  import { pick } from '../player/cover-flight.svelte';
  import { getAppView } from '../shared/app-context.svelte';

  interface Props {
    disabled: boolean;
    now: boolean;
    onplay: () => void;
    selecting?: boolean;
    selected?: boolean;
    onselect?: (event: MouseEvent) => void;
    unplayable?: boolean;
    cover?: HTMLElement;
    rounded?: boolean;
    keyshortcuts?: string;
    class?: ClassValue;
    children: Snippet;
  }

  const {
    disabled,
    now,
    onplay,
    selecting = false,
    selected = false,
    onselect,
    unplayable = false,
    cover,
    rounded = false,
    keyshortcuts,
    class: klass,
    children,
  }: Props = $props();
  const view = getAppView();

  const activate = (event: MouseEvent): void => {
    // 修饰键先判：手动多选里 Shift 连选也走这里
    if (onselect && (event.metaKey || event.ctrlKey || event.shiftKey)) {
      event.preventDefault();
      onselect(event);
      return;
    }
    if (selecting) {
      onplay();
      return;
    }
    if (unplayable) return;
    pick(view, onplay, cover);
  };
</script>

<button
  type="button"
  class={['play-target text-left', rounded && 'rounded', klass]}
  {disabled}
  aria-disabled={unplayable && !selecting ? 'true' : undefined}
  role={selecting ? 'checkbox' : undefined}
  aria-checked={selecting ? selected : undefined}
  aria-keyshortcuts={selecting ? keyshortcuts : undefined}
  data-play-target=""
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
