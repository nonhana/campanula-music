<!-- busy 用 aria-disabled 而不是 disabled：焦点要留在按钮上 -->
<script lang="ts">
  import type { LucideIcon } from '@lucide/svelte';
  import { LoaderCircle } from '@lucide/svelte';
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  import { busyClick } from '../shared/busy';

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

  const look = {
    primary: {
      color:
        'bg-primary-900 text-white disabled:(bg-neutral-200 text-neutral-500)',
      hover: 'mouse:enabled:hover:bg-primary-950',
    },
    download: {
      color:
        'bg-secondary-100 text-secondary-900 disabled:(bg-neutral-200 text-neutral-500)',
      hover: 'mouse:enabled:hover:bg-secondary-200',
    },
    outline: {
      color:
        'border border-neutral-200 bg-white text-neutral-800 disabled:opacity-50',
      hover: 'mouse:enabled:hover:(border-primary-300 bg-primary-50)',
    },
    destructive: {
      color:
        'bg-error-700 text-white disabled:(bg-neutral-200 text-neutral-500)',
      hover: 'mouse:enabled:hover:bg-error-800',
    },
  };

  const click = busyClick(
    () => busy,
    (event) => onclick?.(event),
  );
</script>

<button
  {type}
  class={[
    'pill-hit h-10 inline-flex flex-none items-center justify-center whitespace-nowrap rounded-full text-label font-500 transition-[background-color,border-color,color,opacity,transform] duration-feedback disabled:cursor-not-allowed',
    // 转圈 16px 加 6px 间隔，左右各让出 11px，宽度不变
    Icon ? 'gap-2 pl-4 pr-5' : busy ? 'gap-1.5 px-[9px]' : 'gap-2 px-5',
    look[variant].color,
    busy ? 'cursor-progress' : ['enabled:press', look[variant].hover],
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
