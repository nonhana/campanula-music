<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { CircleArrowDown, MoreHorizontal } from '@lucide/svelte';

  import DetailHeader from '../library/DetailHeader.svelte';
  import { selectionActions } from '../library/selection-actions.svelte';
  import { anchorBelow } from '../menu/menu-anchor';
  import { getOverlays } from '../overlay/overlay-context';
  import { getAppView } from '../shared/app-context.svelte';
  import { desktopLayout } from '../shared/layout';
  import { formatCount } from '../shared/text';
  import PlayAllButton from '../songs/PlayAllButton.svelte';
  import SongList from '../songs/SongList.svelte';
  import type { SongListView } from '../songs/view';
  import Cover from '../ui/Cover.svelte';
  import IconButton from '../ui/IconButton.svelte';
  import SearchField from '../ui/SearchField.svelte';
  import DownloadsTasks from './DownloadsTasks.svelte';

  let { query = $bindable() }: { query: string } = $props();

  const SOURCE = { kind: 'downloads' } as const;

  const view = getAppView();
  const { downloadsMenu } = getOverlays();
  const all = $derived(view.state.downloads.songs);
  const taskCount = $derived(view.state.downloads.tasks.size);
  const signedIn = $derived(view.state.session.status === 'signedIn');
  const phone = $derived(!desktopLayout.current);
  const term = $derived(query.trim());
  const songs = $derived(all && term ? view.app.searchDownloads(term) : all);
  const covers = $derived(
    [
      ...new Set((all ?? []).flatMap((song) => song.album.coverUrl ?? [])),
    ].slice(0, 4),
  );

  const listView = $derived.by((): SongListView => {
    if (all === null) return { kind: 'loading' };
    if (all.length === 0) {
      return {
        kind: 'empty',
        icon: CircleArrowDown,
        title: '还没有下载的歌',
        action: {
          label: signedIn ? '去曲库' : '登录',
          run: () => void goto(resolve('/')),
        },
      };
    }
    return { kind: 'songs', songs: songs ?? [] };
  });

  const search = $derived(term && all ? { term } : null);

  const actions = selectionActions();
  const select = $derived({
    actions: [
      ...(view.state.exportable ? [actions.exportDownloads()] : []),
      actions.removeDownloads(),
    ],
    songs: () => all ?? [],
  });

  const openMenu = (event: MouseEvent): void => {
    const button = event.currentTarget as HTMLElement;
    if (downloadsMenu.request?.from === button) {
      void downloadsMenu.close();
      return;
    }
    downloadsMenu.open({
      from: button,
      anchor: anchorBelow(event),
    });
  };
</script>

{#snippet collage(size: number)}
  <div
    class="relative flex-none"
    style:width="{size}px"
    style:height="{size}px"
  >
    {#if covers.length === 0}
      <span
        class="grid size-full place-items-center rounded-xl bg-secondary-50 text-secondary-800"
        aria-hidden="true"
      >
        <CircleArrowDown size={size > 100 ? 56 : 34} strokeWidth={1.5} />
      </span>
    {:else if covers.length < 4}
      <Cover url={covers[0]} {size} eager class="rounded-xl shadow-ambient" />
    {:else}
      <div
        class="grid grid-cols-2 size-full overflow-hidden rounded-xl shadow-ambient"
        aria-hidden="true"
      >
        {#each covers as url (url)}
          <Cover {url} size={size / 2} eager />
        {/each}
      </div>
    {/if}
    {#if covers.length > 0 && size > 100}
      <span
        class="absolute grid size-11 place-items-center rounded-full bg-secondary-100 text-secondary-800 ring-4 ring-primary-50 -bottom-2 -right-2"
        aria-hidden="true"
      >
        <CircleArrowDown size={22} />
      </span>
    {/if}
  </div>
{/snippet}

{#snippet headerSearch(compact: boolean)}
  <SearchField
    label="在已下载里搜索"
    bind:value={query}
    placeholder={compact ? '搜索' : '在已下载里搜索'}
    class="max-w-[280px] min-w-[128px] w-full"
  />
{/snippet}

<DetailHeader title="已下载" phoneLayout="row" search={headerSearch}>
  {#snippet artwork(size: number)}
    {@render collage(size)}
  {/snippet}
  {#snippet meta()}
    <span class="tabular-nums"
      >{all === null ? '　' : `${formatCount(all.length)} 首`}</span
    >
  {/snippet}
  {#snippet actions()}
    <PlayAllButton songs={all} source={SOURCE} />
    {#if all && all.length > 0}
      <IconButton
        icon={MoreHorizontal}
        label="下载管理"
        title="下载管理"
        onclick={openMenu}
      />
    {/if}
  {/snippet}
</DetailHeader>

{#if phone && all && all.length > 0}
  <div class="px-4 pt-3">
    <SearchField label="在已下载里搜索" bind:value={query} />
  </div>
{/if}

<DownloadsTasks />

<div class={phone ? '' : 'mt-6'}>
  <SongList
    list={listView}
    source={SOURCE}
    loadingLabel="正在读出这台设备上的下载"
    {search}
    skeleton={phone ? 8 : 10}
    headerHidden={false}
    label="已下载的歌曲"
    {phone}
    {select}
    remeasure={taskCount}
  />
</div>
