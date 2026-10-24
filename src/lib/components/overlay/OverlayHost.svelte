<script lang='ts'>
  import { getOverlays } from './overlay-context'

  const overlays = getOverlays()

  const onkeydown = (event: KeyboardEvent) => {
    // drag-sort / playlist-sort / song-drag 在捕获阶段消费 Esc。
    // 让那次取消先做完，同一个事件不要再关一层浮层。
    if (event.key !== 'Escape' || event.defaultPrevented || !overlays.stack.top)
      return
    event.preventDefault()
    event.stopPropagation()
    void overlays.stack.escape()
  }
</script>

<svelte:window {onkeydown} />

{#each overlays.mounted as entry (entry.name)}
  <div class='contents' data-overlay={entry.name} inert={entry.inert()}>
    <entry.component />
  </div>
{/each}
