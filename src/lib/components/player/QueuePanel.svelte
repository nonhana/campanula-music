<script module lang="ts">
  export const QUEUE_PANEL_ID = 'queue-panel';
</script>

<script lang="ts">
  import { getOverlays } from '../overlay/overlay-context';
  import { getAppView } from '../shared/app-context.svelte';
  import { desktopLayout, desktopPanelTop } from '../shared/layout';
  import { float } from '../shared/motion';
  import { focusNowRow } from '../shared/now-locate.svelte';
  import QueueList from './QueueList.svelte';
  import { queueEmpty } from './view';

  const view = getAppView();
  const { queuePanel: layer } = getOverlays();
  const request = $derived(layer.request);
  const top = $derived(desktopPanelTop(view.state.online));

  let panel = $state<HTMLElement>();

  $effect(() => {
    if (request && (!desktopLayout.current || queueEmpty(view.state.player)))
      void layer.close();
  });

  $effect(() => {
    if (!request) return;
    const shown = request;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element;
      if (
        layer.request === shown &&
        !panel?.contains(target) &&
        !target.closest('[data-player-bar]')
      )
        void layer.close(false);
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  });

  // 等队列定位、虚拟列表画出那一行再给焦点
  $effect(() => {
    if (!request || !panel) return;
    const root = panel;
    const frame = requestAnimationFrame(() => focusNowRow(root));
    return () => cancelAnimationFrame(frame);
  });
</script>

{#if request}
  <div
    bind:this={panel}
    id={QUEUE_PANEL_ID}
    class="fixed bottom-24 right-4 z-40 w-[400px] flex flex-col overflow-hidden rounded-xl bg-white shadow-float"
    style:top="{top}px"
    inert={layer.inert}
    in:float={{ toward: 'left', distance: 24, panel: true }}
    out:float={{ toward: 'right', distance: 24, panel: true }}
  >
    <QueueList titled class="min-h-0 flex-1" />
  </div>
{/if}
