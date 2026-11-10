<script lang="ts">
  import { Repeat, Repeat1, Shuffle } from '@lucide/svelte';

  import type { PlayMode } from '#lib/app/player.js';

  import { getAppView } from '../shared/app-context.svelte';
  import { iconSwap } from '../shared/motion';
  import IconButton from '../ui/IconButton.svelte';
  import { NEXT_PLAY_MODE, PLAY_MODE_LABEL } from './view';

  const {
    kind,
    phone = false,
  }:
    | { kind: 'cycle'; phone?: boolean }
    | { kind: 'repeat' | 'shuffle'; phone?: never } = $props();
  const view = getAppView();
  const mode = $derived(view.state.player.mode);

  const ICONS = { loop: Repeat, one: Repeat1, shuffle: Shuffle };
  const toggle = $derived(
    kind === 'repeat'
      ? {
          on: mode !== 'shuffle',
          label: PLAY_MODE_LABEL[mode === 'one' ? 'one' : 'loop'],
          icon: mode === 'one' ? Repeat1 : Repeat,
          to: (mode === 'loop' ? 'one' : 'loop') as PlayMode,
        }
      : {
          on: mode === 'shuffle',
          label: PLAY_MODE_LABEL.shuffle,
          icon: Shuffle,
          to: (mode === 'shuffle' ? 'loop' : 'shuffle') as PlayMode,
        },
  );
</script>

{#if kind === 'cycle'}
  <IconButton
    icon={ICONS[mode]}
    label="播放模式：{PLAY_MODE_LABEL[mode]}"
    title={PLAY_MODE_LABEL[mode]}
    class={[
      mode !== 'loop' &&
        (phone ? 'bg-primary-100 text-primary-950!' : 'text-primary-900!'),
    ]}
    onclick={() => view.app.setPlayMode(NEXT_PLAY_MODE[mode])}
  />
{:else}
  <button
    type="button"
    class={[
      'size-10 grid flex-none place-items-center rounded-full transition-[background-color,color,transform] duration-feedback press',
      toggle.on
        ? 'bg-primary-100 text-primary-950 mouse:hover:bg-primary-200'
        : 'text-neutral-600 mouse:hover:(bg-primary-100 text-primary-950)',
    ]}
    aria-label={toggle.label}
    aria-pressed={toggle.on}
    title={toggle.label}
    onclick={() => view.app.setPlayMode(toggle.to)}
  >
    {#key toggle.icon}
      <span class="grid col-start-1 row-start-1" transition:iconSwap
        ><toggle.icon size={18} aria-hidden="true" /></span
      >
    {/key}
  </button>
{/if}
