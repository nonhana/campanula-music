<!-- class 只给手机那个图标按钮；pressed 是开关，带 aria-pressed -->
<script lang="ts">
  import type { LucideIcon } from '@lucide/svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  import { desktopLayout } from '../shared/layout';
  import Button from './Button.svelte';
  import IconButton from './IconButton.svelte';

  interface Props extends Omit<
    HTMLButtonAttributes,
    'children' | 'aria-label' | 'aria-pressed' | 'title'
  > {
    icon: LucideIcon;
    label: string;
    text?: string;
    pressed?: boolean;
  }

  const {
    icon,
    label,
    text = label,
    pressed,
    class: klass,
    ...rest
  }: Props = $props();
  const pressedLook = $derived(pressed ? '[&_svg]:text-primary-900' : '');
</script>

{#if desktopLayout.current}
  <Button
    variant="outline"
    {icon}
    class={pressedLook}
    aria-pressed={pressed}
    {...rest}>{text}</Button
  >
{:else}
  <IconButton
    {icon}
    {label}
    title={label}
    class={[pressedLook, klass]}
    aria-pressed={pressed}
    {...rest}
  />
{/if}
