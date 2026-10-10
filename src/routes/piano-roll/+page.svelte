<script lang='ts'>
  import SeoHead from '$lib/components/shared/SeoHead.svelte'
  import { generateSeoMetadata } from '$lib/metadata'

  const metadata = generateSeoMetadata('pianoRoll')
</script>

<SeoHead {metadata} />

<h2>这是 FL Studio 钢琴窗页面</h2>
