<script lang="ts">
  import { syncNoticeFor } from '#lib/app/library.ts';
  import {
    homeView,
    preloadHomeView,
  } from '#lib/components/library/home-view.svelte.ts';
  import { getAppView } from '#lib/components/shared/app-context.svelte.ts';
  import { desktopLayout } from '#lib/components/shared/layout.ts';
  import {
    readShelves,
    scrollSnapshot,
    writeShelves,
  } from '#lib/components/shared/snapshot.ts';

  const view = getAppView();
  const library = $derived(view.state.library);
  const likedId = $derived(library?.liked?.playlist.id ?? 0);
  const liked = $derived(library?.playlistPage(likedId) ?? null);
  const notice = $derived(
    library && liked
      ? syncNoticeFor(library, liked.failure?.where === 'list')
      : null,
  );

  const DesktopHome = $derived(homeView.desktop);
  const PhoneHome = $derived(homeView.phone);

  $effect(() => {
    void preloadHomeView(desktopLayout.current);
  });

  let query = $state('');
  let stripEl = $state<HTMLElement>();
  let pendingRestore: {
    strip: number;
    shelves: Record<string, number>;
  } | null = null;

  const applyDesktopRestore = () => {
    if (!pendingRestore) return;
    const target = pendingRestore;
    pendingRestore = null;
    writeShelves(target.shelves);
    if (stripEl) {
      stripEl.scrollLeft = target.strip;
      stripEl.dispatchEvent(new Event('scroll'));
    }
  };

  scrollSnapshot(
    '/',
    () => ({
      query,
      strip: stripEl?.scrollLeft ?? 0,
      shelves: readShelves(),
    }),
    (value) => {
      query = value.query;
      if (DesktopHome) {
        writeShelves(value.shelves);
        if (stripEl) {
          stripEl.scrollLeft = value.strip;
          stripEl.dispatchEvent(new Event('scroll'));
        }
      } else {
        pendingRestore = { strip: value.strip, shelves: value.shelves };
      }
    },
  );
</script>

<svelte:head><title>曲库 · Campanula</title></svelte:head>

{#if library && liked}
  {#if desktopLayout.current}
    {#if DesktopHome}
      <DesktopHome
        {library}
        {liked}
        {notice}
        bind:stripEl
        onReady={applyDesktopRestore}
      />
    {/if}
  {:else if PhoneHome}
    <PhoneHome {library} {likedId} {notice} bind:query />
  {/if}
{/if}
