<script lang="ts">
  import DownloadsPage from '#lib/components/downloads/DownloadsPage.svelte';
  import { scrollSnapshot } from '#lib/components/shared/snapshot.js';

  let query = $state('');
  scrollSnapshot(
    '/downloads',
    () => query,
    (value) => {
      query = value;
    },
  );
</script>

<svelte:head><title>已下载 · Campanula</title></svelte:head>

<DownloadsPage bind:query />
