<script lang='ts'>
  import MessageContainer from '$lib/components/hana/MessageContainer.svelte'
  import LoadingIndicator from '$lib/components/main/LoadingIndicator.svelte'
  import { initSkin } from '$lib/skin'
  import { initSoundLevel } from '$lib/soundLevel'
  import { onMount } from 'svelte'
  import '$lib/skin/skins.css'
  import 'uno.css'
  import '@unocss/reset/tailwind.css'

  const { children } = $props()

  onMount(() => {
    initSkin()
    initSoundLevel()
    // 离线壳 service worker：仅生产构建注册，开发态避免缓存干扰
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
      // 注册失败（如受阻环境）不阻塞使用
      })
    }
  })
</script>

<LoadingIndicator />
<MessageContainer />

{@render children()}
