<script lang='ts'>
  import { untrack } from 'svelte'
  import { getAppView } from '../app-context.svelte'
  import { getOverlays } from '../overlay-context'
  import PlayerPage from './PlayerPage.svelte'

  const view = getAppView()
  const { player, playerDrawer } = getOverlays()
  const hasQueue = $derived(view.state.player.queue.length > 0)
  const open = $derived(hasQueue && player.request !== null)
  const shown = $derived(hasQueue && (open || playerDrawer.visible))
  $effect(() => playerDrawer.settle(open))
  $effect(() => {
    if (!hasQueue && player.request)
      untrack(() => { void player.invalidate() })
  })
</script>

{#if shown}
  <PlayerPage {open} />
{/if}
