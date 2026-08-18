<script lang='ts'>
  import SeoHead from '$lib/components/shared/SeoHead.svelte'
  import { generateSeoMetadata } from '$lib/metadata'
  import SkinSelector from '$lib/skin/SkinSelector.svelte'

  const metadata = generateSeoMetadata('settings')
</script>

<SeoHead {metadata} />

<section class='space-y-8'>
  <header>
    <h1 class='text-2xl text-app-text font-semibold'>设置</h1>
    <p class='mt-1 text-sm text-app-text-muted'>偏好设置即时生效并保存在本机。</p>
  </header>

  <div class='space-y-3'>
    <h2 class='text-base text-app-text font-medium'>皮肤</h2>
    <p class='text-sm text-app-text-muted'>切换整套视觉令牌（颜色、字体、圆角与阴影），偏好将被记住。</p>
    <SkinSelector />
  </div>
</section>
