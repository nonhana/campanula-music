<script lang="ts">
  import { getOverlays } from './overlay-context';

  const overlays = getOverlays();

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
  <div class="contents" data-overlay={entry.name} inert={entry.inert()}>
    <entry.component />
  </div>
{/each}
