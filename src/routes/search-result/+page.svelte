<script lang='ts'>
  import SeoHead from '$lib/components/shared/SeoHead.svelte'
  import { generateSeoMetadata } from '$lib/metadata'

  const metadata = generateSeoMetadata('searchResult')
</script>

<SeoHead {metadata} />

<h2>这是搜索结果页</h2>
