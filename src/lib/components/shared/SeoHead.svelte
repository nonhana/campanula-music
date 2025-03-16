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

  <!-- Open Graph / Facebook -->
  {#if metadata.openGraph}
    <meta property='og:type' content={metadata.openGraph.type || 'website'} />
    <meta property='og:title' content={metadata.openGraph.title} />
    <meta property='og:description' content={metadata.openGraph.description} />

    {#if metadata.openGraph.url}
      <meta property='og:url' content={metadata.openGraph.url} />
    {/if}

    {#if metadata.openGraph.siteName}
      <meta property='og:site_name' content={metadata.openGraph.siteName} />
    {/if}

    {#if metadata.openGraph.images && metadata.openGraph.images.length > 0}
      {#each metadata.openGraph.images as image}
        <meta property='og:image' content={image.url} />
        {#if image.alt}
          <meta property='og:image:alt' content={image.alt} />
        {/if}
        {#if image.width}
          <meta property='og:image:width' content={image.width.toString()} />
        {/if}
        {#if image.height}
          <meta property='og:image:height' content={image.height.toString()} />
        {/if}
      {/each}
    {/if}
  {/if}

  <!-- Twitter -->
  {#if metadata.twitter}
    <meta name='twitter:card' content={metadata.twitter.card} />

    {#if metadata.twitter.site}
      <meta name='twitter:site' content={metadata.twitter.site} />
    {/if}

    <meta name='twitter:title' content={metadata.twitter.title} />
    <meta name='twitter:description' content={metadata.twitter.description} />

    {#if metadata.twitter.image}
      <meta name='twitter:image' content={metadata.twitter.image} />
    {/if}

    {#if metadata.twitter.imageAlt}
      <meta name='twitter:image:alt' content={metadata.twitter.imageAlt} />
    {/if}
  {/if}
</svelte:head>
