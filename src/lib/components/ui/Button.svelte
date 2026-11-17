<!-- busy 用 aria-disabled 而不是 disabled：焦点要留在按钮上 -->
<script lang="ts">
  import type { LucideIcon } from '@lucide/svelte';
  import { LoaderCircle } from '@lucide/svelte';
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  import { busyClick } from '../shared/busy.ts';
  import { pillBase, pillLooks } from './control-styles.ts';

  interface Props extends Omit<HTMLButtonAttributes, 'children'> {
    variant: 'primary' | 'download' | 'outline' | 'destructive';
    icon?: LucideIcon;
    busy?: boolean;
    children?: Snippet;
  }

  const {
    variant,
    icon: Icon,
    busy = false,
    type = 'button',
    class: klass,
    onclick,
    children,
    ...rest
  }: Props = $props();

  const click = busyClick(
    () => busy,
    (event) => onclick?.(event),
  );
</script>

<button
  {type}
  class={[
    pillBase,
    // 转圈 16px 加 6px 间隔，左右各让出 11px，宽度不变
    Icon ? 'gap-2 pl-4 pr-5' : busy ? 'gap-1.5 px-[9px]' : 'gap-2 px-5',
    pillLooks[variant].color,
    busy ? 'cursor-progress' : ['enabled:press', pillLooks[variant].hover],
    klass,
  ]}
  aria-busy={busy || undefined}
  aria-disabled={busy || undefined}
  onclick={click}
  {...rest}
>
  {#if busy}
    <LoaderCircle
      size={Icon ? 18 : 16}
      class="flex-none animate-spin"
      aria-hidden="true"
    />
  {:else if Icon}
    <Icon size={18} aria-hidden="true" />
  {/if}
  {@render children?.()}
</button>
