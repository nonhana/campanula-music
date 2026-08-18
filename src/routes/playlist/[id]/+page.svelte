<script lang='ts'>
  import { page } from '$app/state'
  import SeoHead from '$lib/components/shared/SeoHead.svelte'
  import { generateSeoMetadata } from '$lib/metadata'

  const metadata = generateSeoMetadata('playlistDetail')

  const playlistId = $derived(page.params.id ?? '')
</script>

<SeoHead {metadata} />

<section class='space-y-6'>
  <header>
    <h1 class='text-2xl text-app-text font-semibold'>歌单详情</h1>
    <p class='mt-1 text-sm text-app-text-muted'>歌单 #{playlistId} 的全部歌曲将在这里展示。</p>
  </header>

  <div
    class='flex items-center justify-center border border-app-border rounded-xl border-dashed bg-app-bg p-12 text-sm text-app-text-muted'
  >
    歌单详情将在后续版本提供
  </div>
</section>
