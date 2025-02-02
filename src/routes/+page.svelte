<script lang='ts'>
  import PlaylistList from '$lib/components/home/PlaylistList.svelte'
  import SongList from '$lib/components/home/SongList.svelte'
</script>

<svelte:head>
  <title>Home</title>
  <meta name='description' content='Svelte demo app' />
</svelte:head>

<SongList />
<PlaylistList />
