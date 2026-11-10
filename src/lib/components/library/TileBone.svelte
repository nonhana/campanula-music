<script lang="ts">
  import type { ClassValue } from 'svelte/elements';

  interface Props {
    round?: boolean;
    detail?: boolean;
    phone?: boolean;
    class?: ClassValue;
  }

  const {
    round = false,
    detail = true,
    phone = false,
    class: klass,
  }: Props = $props();
</script>

<div class={klass}>
  <span
    class={['bone aspect-square w-full', round ? 'rounded-full' : 'rounded-lg']}
  ></span>
  <span
    class={[
      'mt-2.5 flex items-center',
      phone && !round ? 'h-5.5' : 'h-5',
      round && 'justify-center',
    ]}
  >
    <span class={['bone h-3.5 rounded-full', round ? 'w-2/3' : 'w-3/4']}></span>
  </span>
  {#if detail}
    <span class={['mt-0.5 h-5 flex items-center', round && 'justify-center']}>
      <span class="bone h-3 w-1/2 rounded-full"></span>
    </span>
  {/if}
</div>
