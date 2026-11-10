<script lang="ts">
  import { Play } from '@lucide/svelte';

  import type { Song } from '#lib/api/library.js';
  import type { PlaySource } from '#lib/api/playback.js';

  import { getAppView } from '../shared/app-context.svelte';
  import Button from '../ui/Button.svelte';
  import { songLook } from './song-look';

  const {
    songs,
    source,
    label = '播放全部',
  }: {
    songs: readonly Song[] | null;
    source: PlaySource;
    label?: string;
  } = $props();
  const view = getAppView();
</script>

<Button
  variant="primary"
  icon={Play}
  disabled={!songs?.some((song) => !songLook(view, song).off)}
  onclick={() => view.app.playAll(source)}>{label}</Button
>
