<script lang='ts'>
  import AppNav from '$lib/components/app/AppNav.svelte'
  import InstallPrompt from '$lib/components/app/InstallPrompt.svelte'
  import MessageContainer from '$lib/components/hana/MessageContainer.svelte'
  import LoadingIndicator from '$lib/components/main/LoadingIndicator.svelte'
  import Player from '$lib/components/player/Player.svelte'
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
<InstallPrompt />

<Player />

<div class='flex flex-col bg-app-bg text-app-text min-h-dvh md:pl-60'>
  <AppNav />
  <main class='flex-1'>
    <div class='mx-auto max-w-5xl w-full px-4 pb-40 pt-6 md:px-8 md:pb-28 md:pt-10'>
      {@render children()}
    </div>
  </main>
</div>
