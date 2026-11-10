<script lang="ts">
  import type { Song } from '#lib/api/library.js';
  import { songTitle } from '#lib/api/library.js';

  import { getAppView } from '../shared/app-context.svelte';
  import { fade } from '../shared/motion';
  import { langOf } from '../shared/text';
  import CreditLine from '../songs/CreditLine.svelte';
  import CreditName from '../songs/CreditName.svelte';
  import SongBadge from '../songs/SongBadge.svelte';
  import SongSwap from './SongSwap.svelte';
  import type { Turn } from './view';

  const {
    song,
    turn,
    phone = false,
  }: { song: Song; turn: Turn | null; phone?: boolean } = $props();
  const view = getAppView();
</script>

<SongSwap {song} {turn} place="page">
  {#snippet children(shown)}
    <div class="min-w-0 flex items-center gap-2">
      <h2
        class={[
          'truncate text-neutral-900 font-600',
          phone ? 'text-title' : 'text-headline-sm',
        ]}
        lang={langOf(shown.name)}
      >
        {songTitle(shown)}
      </h2>
      {#if view.state.player.trial}<span class="flex flex-none" transition:fade
          ><SongBadge kind="trial" /></span
        >{/if}
    </div>
    <CreditLine
      artists={shown.artists}
      linked
      tabbable
      padded={phone}
      class={[
        '-mx-1 -mb-1 -mt-0.5 block truncate p-1 text-body text-neutral-700',
        phone && 'leading-8',
      ]}
    />
    {#if shown.album.name}
      <p
        class={[
          '-m-1 truncate p-1 text-label text-neutral-600 font-400',
          phone && 'leading-8',
        ]}
        lang={langOf(shown.album.name)}
      >
        <CreditName
          kind="album"
          target={shown.album}
          linked
          tabbable
          padded={phone}
        />
      </p>
    {/if}
  {/snippet}
</SongSwap>
