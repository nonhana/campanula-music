<script lang="ts">
  import type { LucideIcon } from '@lucide/svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  import { iconSwap } from '../shared/motion';

  interface Props extends Omit<
    HTMLButtonAttributes,
    'children' | 'aria-label'
  > {
    icon: LucideIcon;
    label: string;
    filled?: boolean;
  }

  const {
    icon: Icon,
    label,
    filled = false,
    type = 'button',
    class: klass,
    ...rest
  }: Props = $props();
</script>

<button
  {type}
  aria-label={label}
  class={[
    'size-11 grid flex-none place-items-center rounded-full text-neutral-700 transition-[background-color,color,opacity,transform] duration-feedback md:size-10 enabled:press disabled:(cursor-not-allowed opacity-50) mouse:enabled:hover:(bg-primary-100 text-primary-950)',
    klass,
  ]}
  {...rest}
>
  {#key Icon}
    <span class="grid col-start-1 row-start-1" transition:iconSwap>
      <Icon
        size={20}
        fill={filled ? 'currentColor' : 'none'}
        aria-hidden="true"
      />
    </span>
  {/key}
</button>
