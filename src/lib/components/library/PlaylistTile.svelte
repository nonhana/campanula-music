<script lang="ts">
  import { resolve } from '$app/paths';
  import { Lock } from '@lucide/svelte';

  import { getAppView } from '../shared/app-context.svelte';
  import { formatSongCount, langOf } from '../shared/text';
  import NowBars from '../songs/NowBars.svelte';
  import Cover from '../ui/Cover.svelte';
  import Tag from '../ui/Tag.svelte';
  import { collectState } from './collect';
  import CollectButton from './CollectButton.svelte';
  import { FLIGHT_COVER_SIZE } from './flight';
  import { ROW_COVER_SIZE } from './tile-grid';

  interface Props {
    id: number;
    name: string;
    coverUrl: string | null;
    trackCount: number | null;
    creator: string | null;
    locked?: boolean;
    phone?: boolean;
    onkeydown?: (event: KeyboardEvent) => void;
    collectable?: boolean;
    look?: 'grid' | 'row' | 'nav';
    current?: boolean;
    now?: boolean;
    /** 封面飞行的起点；浮起的副本要关掉，同一时刻一个名字只能有一个元素 */
    flight?: boolean;
  }

  const {
    id,
    name,
    coverUrl,
    trackCount,
    creator,
    locked = false,
    phone = false,
    onkeydown,
    collectable = false,
    look = 'grid',
    current = false,
    now = false,
    flight = true,
  }: Props = $props();
  const view = getAppView();
  const library = $derived(view.state.library);
  const status = $derived(
    collectable && library
      ? collectState(library, { kind: 'playlist', id })
      : null,
  );
  const page = $derived(resolve('/playlists/[id=neteaseId]', { id }));
  const songCount = $derived(formatSongCount(trackCount));
</script>

{#snippet rowBody()}
  <Cover url={coverUrl} size={ROW_COVER_SIZE} class="rounded-md" />
  <span class="min-w-0 flex-1">
    <span
      class={[
        'block truncate text-label font-500',
        current ? 'text-primary-950' : 'text-neutral-900',
      ]}
      lang={langOf(name)}>{name}</span
    >
    {#if songCount !== null || locked}
      <span
        class={[
          'mt-0.5 flex items-center gap-1 text-caption',
          current ? 'text-primary-900' : 'text-neutral-600',
        ]}
      >
        {#if songCount !== null}<span class="flex-none tabular-nums"
            >{songCount}</span
          >{/if}
        {#if locked}
          <Lock size={12} class="flex-none" aria-hidden="true" /><span
            class="sr-only">隐私歌单</span
          >
        {/if}
      </span>
    {/if}
  </span>
{/snippet}

{#if look === 'nav'}
  <a
    href={resolve('/playlists/[id=neteaseId]', { id })}
    class={[
      'h-14 flex items-center gap-3 rounded-lg px-2 transition-colors duration-feedback',
      current ? 'bg-primary-200' : 'mouse:hover:bg-primary-100',
    ]}
    aria-current={current ? 'page' : undefined}
    {onkeydown}
  >
    {@render rowBody()}
    {#if now}<NowBars /><span class="sr-only">正在播放</span>{/if}
  </a>
{:else if look === 'row'}
  <div class="relative min-w-0 flex flex-1 items-center gap-3">
    <a
      href={resolve('/playlists/[id=neteaseId]', { id })}
      class="min-w-0 flex flex-1 items-center gap-3 rounded-lg"
      {onkeydown}
    >
      {@render rowBody()}
    </a>
  </div>
{:else}
  <div class="relative min-w-0">
    <a
      href={resolve('/playlists/[id=neteaseId]', { id })}
      class="group block min-w-0 rounded-lg"
      {onkeydown}
    >
      <Cover
        url={coverUrl}
        size={FLIGHT_COVER_SIZE}
        fluid
        flight={flight ? page : undefined}
        class="rounded-lg shadow-ambient transition-[filter] duration-feedback mouse:group-hover:brightness-95"
      />
      <span
        class={[
          'mt-2.5 block truncate text-neutral-900 font-500',
          phone ? 'text-body' : 'text-label',
        ]}
        lang={langOf(name)}>{name}</span
      >
      {#if songCount !== null || locked || creator}
        <span
          class="mt-0.5 min-w-0 flex items-center gap-1 text-caption text-neutral-600"
        >
          {#if songCount !== null}<span class="flex-none tabular-nums"
              >{songCount}</span
            >{/if}
          {#if locked}
            <Lock size={12} class="flex-none" aria-hidden="true" /><span
              class="sr-only">隐私歌单</span
            >
          {/if}
          {#if creator}
            <span class="truncate" lang={langOf(creator)}
              >{songCount !== null || locked ? `· ${creator}` : creator}</span
            >
          {/if}
        </span>
      {/if}
    </a>
    {#if collectable && status}
      <div class="pointer-events-none absolute inset-x-0 top-0 aspect-square">
        {#if status === 'own'}
          <span class="absolute bottom-2 right-2"><Tag>自建</Tag></span>
        {:else}
          <CollectButton
            target={{ kind: 'playlist', id }}
            {name}
            look="corner"
            class="pointer-events-auto absolute bottom-2 right-2"
          />
        {/if}
      </div>
    {/if}
  </div>
{/if}
