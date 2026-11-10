<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends Omit<
    HTMLButtonAttributes,
    'children' | 'aria-pressed'
  > {
    selected?: boolean;
    children: Snippet;
  }

  const {
    selected,
    type = 'button',
    class: klass,
    children,
    ...rest
  }: Props = $props();
</script>

<button
  {type}
  aria-pressed={selected}
  class={[
    'h-9 inline-flex flex-none items-center rounded-full px-4 text-label font-500 transition-[background-color,border-color,color,opacity] duration-feedback disabled:(cursor-not-allowed opacity-50)',
    selected
      ? 'bg-primary-200 text-primary-950'
      : 'border border-neutral-200 bg-white text-neutral-700 mouse:enabled:hover:(border-primary-300 bg-primary-50 text-neutral-900)',
    klass,
  ]}
  {...rest}
>
  {@render children()}
</button>
