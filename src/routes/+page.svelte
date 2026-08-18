<script lang='ts'>
  import SeoHead from '$lib/components/shared/SeoHead.svelte'
  import { generateSeoMetadata } from '$lib/metadata'

  const metadata = generateSeoMetadata('home')
</script>

<SeoHead {metadata} />

<section class='h-full flex flex-col items-center justify-center gap-4 py-24'>
  <h1 class='text-2xl font-semibold'>Campanula</h1>
  <p class='text-neutral-500'>属于自己的风铃草音乐。应用正在构建中，敬请期待。</p>
</section>
