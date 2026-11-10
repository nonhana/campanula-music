<script lang="ts" module>
  import { DEFAULT_VOLUME } from '#lib/app/player.js';

  let unmuted = DEFAULT_VOLUME;
</script>

<script lang="ts">
  import { Volume1, Volume2, VolumeX } from '@lucide/svelte';
  import type { ClassValue } from 'svelte/elements';

  import { getAppView } from '../shared/app-context.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import VolumeSlider from './VolumeSlider.svelte';

  const { class: sliderClass }: { class?: ClassValue } = $props();
  const view = getAppView();
  const volume = $derived(view.state.player.volume);

  const toggleMute = () => {
    if (volume > 0) {
      unmuted = volume;
      view.app.setVolume(0);
    } else {
      view.app.setVolume(unmuted);
    }
  };
</script>

<IconButton
  icon={volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2}
  label={volume === 0 ? '取消静音' : '静音'}
  onclick={toggleMute}
/>
<VolumeSlider class={sliderClass} />
