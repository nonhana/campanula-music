<!-- 按钮里不能放链接：creditsOutside 时歌手一行画在外面，这里只留读屏用的一份 -->
<script lang="ts">
  import type { Song } from '#lib/api/library.js';
  import { songTitle } from '#lib/api/library.js';

  import { artistLine, langOf } from '../shared/text';
  import DownloadMark from './DownloadMark.svelte';
  import type { SongLook } from './song-look';
  import SongBadge from './SongBadge.svelte';

  interface Props {
    song: Song;
    now: boolean;
    look: SongLook;
    size?: 'label' | 'body';
    mark?: boolean;
    tight?: boolean;
    creditsOutside?: boolean;
  }

  const {
    song,
    now,
    look,
    size = 'label',
    mark = false,
    tight = false,
    creditsOutside = false,
  }: Props = $props();
  const artist = $derived(artistLine(song));
</script>

<span class={['min-w-0 flex items-center', tight ? 'gap-1.5' : 'gap-2']}>
  <span
    class={[
      'truncate font-500 transition-colors duration-state',
      size === 'body' ? 'text-body' : 'text-label',
      now ? 'text-primary-950' : 'text-neutral-900',
    ]}
    lang={langOf(song.name)}>{songTitle(song)}</span
  >
  <SongBadge kind={look.badge} />
</span>
{#if creditsOutside}
  <span class="sr-only">{@render credits()}</span>
{:else}
  {@render credits()}
{/if}

{#snippet credits()}
  {#if mark}
    <span
      class={[
        'flex items-center gap-1.5 text-caption text-neutral-600',
        size === 'body' && 'mt-0.5',
      ]}
    >
      {#if look.mark}<DownloadMark mark={look.mark} variant="inline" />{/if}
      <span class="min-w-0 truncate" lang={langOf(artist)}>{artist}</span>
    </span>
  {:else}
    <span
      class="block truncate text-caption text-neutral-600"
      lang={langOf(artist)}>{artist}</span
    >
  {/if}
{/snippet}
