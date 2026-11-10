<script lang="ts">
  import { GripVertical } from '@lucide/svelte';
  import type { Attachment } from 'svelte/attachments';
  import type { ClassValue } from 'svelte/elements';

  interface Props {
    label: string;
    size: 'phone' | 'desktop';
    attach?: Attachment<HTMLElement>;
    ghost?: boolean;
    overlay?: boolean;
    class?: ClassValue;
    onkeydown?: (event: KeyboardEvent) => void;
  }

  const {
    label,
    size,
    attach,
    ghost = false,
    overlay = false,
    class: klass,
    onkeydown,
  }: Props = $props();
  const shape = $derived(
    overlay || size === 'phone' ? 'rounded-full' : 'rounded-lg',
  );
  const tone = $derived(
    overlay
      ? 'bg-white/95 shadow-ambient ring-1 ring-neutral-900/5 text-neutral-600 backdrop-blur'
      : 'text-neutral-500',
  );
</script>

{#if ghost}
  <span
    class={[
      'relative z-1 grid flex-none place-items-center',
      tone,
      shape,
      size === 'phone' ? 'size-11' : 'size-9',
      klass,
    ]}
    aria-hidden="true"
  >
    <GripVertical size={size === 'phone' ? 20 : 18} aria-hidden="true" />
  </span>
{:else}
  <button
    type="button"
    data-grip
    tabindex={-1}
    class={[
      'relative z-1 grid flex-none place-items-center transition-colors duration-feedback mouse:hover:(bg-primary-100 text-primary-950) focus-visible:(outline-2 outline-offset-2 outline-primary-800)',
      tone,
      shape,
      size === 'phone' ? 'size-11 active:bg-primary-100' : 'size-9',
      klass,
    ]}
    aria-label="拖动排序：{label}"
    title="Alt + ↑ / ↓"
    aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
    {onkeydown}
    {@attach attach}
  >
    <GripVertical size={size === 'phone' ? 20 : 18} aria-hidden="true" />
  </button>
{/if}
