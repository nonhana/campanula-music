<!-- 这几个字号是图形、不属字号阶梯，所以写死 px，不用 text-<档名> -->
<script lang="ts">
  import type { ClassValue } from 'svelte/elements';

  const {
    day,
    size,
    class: klass,
  }: {
    day: number;
    size: 'icon' | 'tile' | 'phone' | 'page';
    class?: ClassValue;
  } = $props();
</script>

<span
  class={[
    'block tabular-nums font-600',
    size === 'icon'
      ? 'text-micro leading-3 text-neutral-900'
      : ['text-primary-900', size],
    klass,
  ]}
  aria-hidden="true">{day}</span
>

<style>
  .tile {
    font-size: 56px;
    line-height: 52px;
    letter-spacing: -0.03em;
  }

  .phone {
    font-size: 72px;
    line-height: 64px;
    letter-spacing: -0.04em;
  }

  .page {
    font-size: 88px;
    line-height: 76px;
    letter-spacing: -0.04em;
  }
</style>
