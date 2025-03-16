<script lang='ts'>
  import SeoHead from '$lib/components/shared/SeoHead.svelte'
  import { generateSeoMetadata } from '$lib/metadata'

  const metadata = generateSeoMetadata('myWorks')
</script>

<SeoHead {metadata} />

<h2>这是我自己创作的歌曲页</h2>
