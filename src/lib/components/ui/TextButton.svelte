<!-- class 两种样子都会加上，只给一种的用 max-md: / md: 前缀 -->
<script lang="ts">
  import type { LucideIcon } from '@lucide/svelte';
  import { LoaderCircle } from '@lucide/svelte';
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  import { busyClick } from '../shared/busy';
  import { desktopLayout } from '../shared/layout';
  import Button from './Button.svelte';

  interface Props extends Omit<HTMLButtonAttributes, 'children'> {
    tone?: 'primary' | 'neutral';
    strong?: boolean;
    size?: 'body' | 'label' | 'caption';
    icon?: LucideIcon;
    href?: string;
    busy?: boolean;
    desktop?: { variant: 'primary' | 'outline'; icon?: LucideIcon };
    children: Snippet;
  }

  const {
    tone = 'primary',
    strong = false,
    size = 'label',
    icon: Icon,
    href,
    busy = false,
    desktop,
    type = 'button',
    class: klass,
    onclick,
    children,
    ...rest
  }: Props = $props();

  const SIZES = {
    body: 'text-body',
    label: 'text-label',
    caption: 'text-caption',
  };
  const weight = $derived(
    strong ? 'font-600' : size === 'body' ? 'font-400' : 'font-500',
  );
  const color = $derived(
    tone === 'primary'
      ? 'text-primary-900 disabled:text-neutral-500'
      : [
          size === 'caption' ? 'text-neutral-600' : 'text-neutral-700',
          'disabled:opacity-50',
        ],
  );
  const pressed = $derived(
    tone === 'primary' ? 'active:bg-primary-100' : 'active:bg-neutral-100',
  );
  const click = busyClick(
    () => busy,
    (event) => onclick?.(event),
  );
</script>

{#if desktop && desktopLayout.current}
  <Button
    variant={desktop.variant}
    icon={desktop.icon}
    {busy}
    {type}
    class={klass}
    {onclick}
    {...rest}>{@render children()}</Button
  >
{:else}
  <svelte:element
    this={href ? 'a' : 'button'}
    {href}
    type={href ? undefined : type}
    class={[
      'h-11 inline-flex flex-none items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 transition-[background-color,color,opacity,transform] duration-feedback disabled:cursor-not-allowed',
      busy
        ? 'cursor-progress'
        : [
            'press mouse:not-disabled:hover:(bg-primary-100 text-primary-950)',
            pressed,
          ],
      SIZES[size],
      weight,
      color,
      klass,
    ]}
    aria-busy={busy || undefined}
    aria-disabled={busy || undefined}
    onclick={click}
    {...rest}
  >
    {#if busy && Icon}
      <LoaderCircle
        size={16}
        class="flex-none animate-spin"
        aria-hidden="true"
      />
    {:else if Icon}
      <Icon size={16} class="flex-none" aria-hidden="true" />
    {/if}
    {#if busy && !Icon}
      <!-- 用 inset-y-0 + my-auto 居中：旋转动画会盖掉 translate -->
      <span class="relative">
        <LoaderCircle
          size={16}
          class="absolute inset-y-0 right-full my-auto mr-1.5 animate-spin"
          aria-hidden="true"
        />
        {@render children()}
      </span>
    {:else}
      {@render children()}
    {/if}
  </svelte:element>
{/if}
