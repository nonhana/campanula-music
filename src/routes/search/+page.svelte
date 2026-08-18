<script lang='ts'>
  import SeoHead from '$lib/components/shared/SeoHead.svelte'
  import { generateSeoMetadata } from '$lib/metadata'

  const metadata = generateSeoMetadata('search')
</script>

<SeoHead {metadata} />

<section class='space-y-6'>
  <header>
    <h1 class='text-2xl text-app-text font-semibold'>搜索</h1>
    <p class='mt-1 text-sm text-app-text-muted'>按关键词搜索歌曲、歌单与歌手。</p>
  </header>

  <div
    class='flex items-center justify-center border border-app-border rounded-xl border-dashed bg-app-bg p-12 text-sm text-app-text-muted'
  >
    搜索正在构建中
  </div>
</section>
