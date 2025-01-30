<script lang='ts'>
  import Button from '$lib/components/hana/Button.svelte'
  import Tooltip from '$lib/components/hana/Tooltip.svelte'
</script>

<svelte:head>
  <title>Home</title>
  <meta name='description' content='Svelte demo app' />
</svelte:head>

<h1>Home</h1>

<Tooltip content='This is a tooltip' trigger='click'>
  <Button>Hover me</Button>
</Tooltip>
