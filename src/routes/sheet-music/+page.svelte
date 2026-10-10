<script lang='ts'>
  import SeoHead from '$lib/components/shared/SeoHead.svelte'
  import { generateSeoMetadata } from '$lib/metadata'

  const metadata = generateSeoMetadata('sheetMusic')
</script>

<SeoHead {metadata} />

<h2>这是我收录的乐谱页</h2>
