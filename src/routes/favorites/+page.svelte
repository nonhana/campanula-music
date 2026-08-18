<script lang='ts'>
  import SeoHead from '$lib/components/shared/SeoHead.svelte'
  import { generateSeoMetadata } from '$lib/metadata'

  const metadata = generateSeoMetadata('favorites')
</script>

<SeoHead {metadata} />

<section class='space-y-6'>
  <header>
    <h1 class='text-2xl text-app-text font-semibold'>我喜欢的音乐</h1>
    <p class='mt-1 text-sm text-app-text-muted'>红心过的歌曲将在这里按时间倒序展示。</p>
  </header>

  <div
    class='flex items-center justify-center border border-app-border rounded-xl border-dashed bg-app-bg p-12 text-sm text-app-text-muted'
  >
    我喜欢的音乐将在绑定网易云账号后展示
  </div>
</section>
