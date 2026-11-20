<script lang="ts" module>
  import type { Component } from 'svelte';

  import type { LibraryState, PlaylistPage } from '#lib/app/library.ts';
  import { syncNoticeFor } from '#lib/app/library.ts';

  type HomeNotice = ReturnType<typeof syncNoticeFor>;
  type DesktopHomeComponent = Component<{
    library: LibraryState;
    liked: PlaylistPage;
    notice: HomeNotice;
    stripEl?: HTMLElement;
    onReady?: () => void;
  }>;
  type PhoneHomeComponent = Component<{
    library: LibraryState;
    likedId: number;
    notice: HomeNotice;
    query: string;
  }>;

  let cachedDesktop: DesktopHomeComponent | undefined;
  let cachedPhone: PhoneHomeComponent | undefined;
</script>

<script lang="ts">
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

  let DesktopHome = $state.raw<DesktopHomeComponent | undefined>(cachedDesktop);
  let PhoneHome = $state.raw<PhoneHomeComponent | undefined>(cachedPhone);
  let loadingDesktop = false;
  let loadingPhone = false;

  $effect(() => {
    if (desktopLayout.current) {
      if (DesktopHome || loadingDesktop) return;
      loadingDesktop = true;
      void import('#lib/components/library/DesktopLibraryHome.svelte')
        .then((module) => {
          cachedDesktop = module.default;
          DesktopHome = module.default;
        })
        .catch((error: unknown) => {
          loadingDesktop = false;
          console.error('加载桌面曲库失败', error);
        });
    } else {
      if (PhoneHome || loadingPhone) return;
      loadingPhone = true;
      void import('#lib/components/library/PhoneLibraryHome.svelte')
        .then((module) => {
          cachedPhone = module.default;
          PhoneHome = module.default;
        })
        .catch((error: unknown) => {
          loadingPhone = false;
          console.error('加载手机曲库失败', error);
        });
    }
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
