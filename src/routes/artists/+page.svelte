<script lang="ts">
  import { syncNoticeFor } from '#lib/app/library.js';
  import CollectedGrid from '#lib/components/library/CollectedGrid.svelte';
  import SyncNotice from '#lib/components/library/SyncNotice.svelte';
  import { getAppView } from '#lib/components/shared/app-context.svelte.js';
  import { desktopLayout } from '#lib/components/shared/layout.js';
  import { scrollSnapshot } from '#lib/components/shared/snapshot.js';

  const view = getAppView();
  const library = $derived(view.state.library);
  const notice = $derived(
    library && syncNoticeFor(library, library.artists === null),
  );
  let query = $state('');
  scrollSnapshot(
    '/artists',
    () => query,
    (value) => {
      query = value;
    },
  );
</script>

<svelte:head><title>歌手 · Campanula</title></svelte:head>

{#if library}
  {#if desktopLayout.current}
    <SyncNotice {notice} />
    <CollectedGrid {library} kind="artists" layout="grid" bind:query />
  {:else}
    <h1 class="sr-only">歌手</h1>
    <SyncNotice {notice} phone />
    <CollectedGrid {library} kind="artists" layout="phone" bind:query />
  {/if}
{/if}
