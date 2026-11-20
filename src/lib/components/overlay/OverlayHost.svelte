<script lang="ts">
  import type { Component } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';

  import { getOverlays } from './overlay-context.ts';

  const overlays = getOverlays();
  const loaded = new SvelteMap<string, Component>();
  const loading: Record<string, boolean> = {};

  $effect(() => {
    for (const entry of overlays.mounted) {
      if (!entry.active() || loaded.has(entry.name) || loading[entry.name])
        continue;
      loading[entry.name] = true;
      void entry
        .load()
        .then(({ default: component }) => {
          loaded.set(entry.name, component);
        })
        .catch((error: unknown) => {
          delete loading[entry.name];
          console.error(`加载浮层 ${entry.name} 失败`, error);
        });
    }
  });

  const onkeydown = (event: KeyboardEvent) => {
    // drag-sort 等在捕获阶段消费 Esc，那次取消先做完，同一个事件别再关一层
    if (event.key !== 'Escape' || event.defaultPrevented || !overlays.stack.top)
      return;
    event.preventDefault();
    event.stopPropagation();
    void overlays.stack.escape();
  };
</script>

<svelte:window {onkeydown} />

{#each overlays.mounted as entry (entry.name)}
  {@const Overlay = loaded.get(entry.name)}
  <div class="contents" data-overlay={entry.name} inert={entry.inert()}>
    {#if Overlay}
      <Overlay />
    {/if}
  </div>
{/each}
