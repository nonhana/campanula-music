<script lang='ts'>
  import { resolve } from '$app/paths'
  import SeoHead from '$lib/components/shared/SeoHead.svelte'
  import { generateSeoMetadata } from '$lib/metadata'
  import { Heart } from 'lucide-svelte'

  const metadata = generateSeoMetadata('home')
</script>

<SeoHead {metadata} />

<section class='space-y-6'>
  <header>
    <h1 class='text-2xl text-app-text font-semibold'>我的歌单</h1>
    <p class='mt-1 text-sm text-app-text-muted'>账号绑定后，这里将展示你创建与收藏的歌单。</p>
  </header>

  <div class='grid gap-4 sm:grid-cols-2'>
    <!-- 我喜欢的音乐入口 -->
    <a
      href={resolve('/favorites')}
      class='flex items-center gap-4 border border-app-border rounded-xl bg-app-surface p-5 shadow-sm transition-colors hover:bg-app-surface-hover'
    >
      <span class='size-12 flex shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent-600'>
        <Heart class='size-6' />
      </span>
      <span class='min-w-0'>
        <span class='block text-app-text font-semibold'>我喜欢的音乐</span>
        <span class='mt-0.5 block text-sm text-app-text-muted'>你红心过的每一首歌都在这里</span>
      </span>
    </a>

    <!-- 我的歌单占位 -->
    <div
      class='flex items-center justify-center border border-app-border rounded-xl border-dashed bg-app-bg p-5 text-sm text-app-text-muted'
    >
      歌单列表将在绑定网易云账号后展示
    </div>
  </div>
</section>
