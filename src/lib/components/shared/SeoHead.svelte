<script lang='ts'>
  import type { SeoMetadata } from '$lib/metadata'

  interface Props {
    metadata: SeoMetadata
  }

  const { metadata }: Props = $props()
</script>

<svelte:head>
  <title>{metadata.title}</title>
  <meta name='description' content={metadata.description} />

  {#if metadata.keywords}
    <meta name='keywords' content={metadata.keywords} />
  {/if}

  {#if metadata.canonical}
    <link rel='canonical' href={metadata.canonical} />
  {/if}
</svelte:head>
