<script lang="ts">
  import { SkipForward } from '@lucide/svelte';

  import { getAppView } from '../shared/app-context.svelte.ts';
  import HeartButton from '../songs/HeartButton.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import { currentSong } from './now.ts';
  import NowPlaying from './NowPlaying.svelte';
  import PlayButton from './PlayButton.svelte';
  import ProgressLine from './ProgressLine.svelte';
  import { PAGE_COVER } from './view.ts';

  const view = getAppView();
  const player = $derived(view.state.player);
  const song = $derived(currentSong(player));
</script>

<div class="h-full min-h-16 flex items-center gap-1 py-2 pl-2 pr-1.5">
  {#if song}
    <NowPlaying
      size={44}
      pageCover={PAGE_COVER.phone}
      class="h-full active:bg-neutral-50"
      nameClass="gap-1.5"
    />
    <HeartButton {song} size="phone" />
  {/if}
  <PlayButton />
  <IconButton
    icon={SkipForward}
    filled
    label="下一首"
    onclick={() => view.app.next()}
  />
</div>
<ProgressLine />
