<script lang="ts">
  import { resolve } from '$app/paths';

  import { playlistName } from '#lib/api/library.js';
  import type { SearchedPlaylist } from '#lib/api/search.js';

  import { collectState } from '../library/collect';
  import CollectButton from '../library/CollectButton.svelte';
  import { getAppView } from '../shared/app-context.svelte';
  import { stagger } from '../shared/motion';
  import { formatPlays, formatSongCount, langOf } from '../shared/text';
  import Cover from '../ui/Cover.svelte';
  import Tag from '../ui/Tag.svelte';

  interface Props {
    playlists: readonly SearchedPlaylist[];
    phone?: boolean;
    appendedAt?: number;
  }

  const { playlists, phone = false, appendedAt = 0 }: Props = $props();
  const view = getAppView();
  const library = $derived(view.state.library);

  const counts = (playlist: SearchedPlaylist): string[] =>
    [
      formatSongCount(playlist.trackCount),
      playlist.playCount !== null && playlist.playCount > 0
        ? `播放 ${formatPlays(playlist.playCount)}`
        : null,
    ].filter((part): part is string => part !== null);
</script>

<ul aria-label="歌单" data-reveal-group>
  {#each playlists as playlist, i (playlist.id)}
    {@const target = { kind: 'playlist', id: playlist.id } as const}
    {@const status = library && collectState(library, target)}
    {@const toggle = status !== null && status !== 'own'}
    {@const meta = counts(playlist)}
    <li
      class={[
        'h-16 flex items-center transition-colors duration-feedback mouse:hover:bg-primary-100',
        !phone && 'rounded-lg',
        toggle && 'pr-1',
      ]}
      in:stagger={{ order: i - appendedAt }}
    >
      <a
        href={resolve('/playlists/[id=neteaseId]', { id: playlist.id })}
        class={[
          'h-full min-w-0 flex flex-1 items-center gap-3',
          phone ? 'pl-4' : 'rounded-lg pl-2',
          toggle ? 'pr-2' : phone ? 'pr-4' : 'pr-2',
        ]}
      >
        <Cover url={playlist.coverUrl} size={48} class="rounded-lg" />
        <span class="min-w-0 flex-1">
          <span
            class={[
              'block truncate text-neutral-900 font-500',
              phone ? 'text-body' : 'text-label',
            ]}
            lang={langOf(playlist.name)}>{playlistName(playlist)}</span
          >
          {#if playlist.creator !== null || meta.length > 0}
            <span
              class="block truncate text-caption text-neutral-600 tabular-nums"
            >
              {#if playlist.creator !== null}<span
                  lang={langOf(playlist.creator)}>{playlist.creator}</span
                >{/if}{playlist.creator !== null && meta.length > 0
                ? ' · '
                : ''}{meta.join(' · ')}
            </span>
          {/if}
        </span>
        {#if status === 'own'}<Tag>自建</Tag>{/if}
      </a>
      {#if toggle}
        <CollectButton {target} name={playlistName(playlist)} look="icon" />
      {/if}
    </li>
  {/each}
</ul>
