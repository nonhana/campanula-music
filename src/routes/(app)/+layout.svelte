<script lang='ts'>
  import { runBindingCheck } from '$lib/binding'
  import AppNav from '$lib/components/app/AppNav.svelte'
  import BindingInvalidBanner from '$lib/components/app/BindingInvalidBanner.svelte'
  import InstallPrompt from '$lib/components/app/InstallPrompt.svelte'
  import MessageContainer from '$lib/components/hana/MessageContainer.svelte'
  import Player from '$lib/components/player/Player.svelte'
  import { BINDING_HEARTBEAT_INTERVAL } from '$lib/ncm/binding'
  import { onMount } from 'svelte'

  const { children } = $props()

  onMount(() => {
    // 绑定心跳：冷启动校验一次 + 低频周期复检；失效/未绑定由编排驱动全局引导
    void runBindingCheck()
    const timer = setInterval(() => void runBindingCheck(), BINDING_HEARTBEAT_INTERVAL)
    return () => clearInterval(timer)
  })
</script>

<MessageContainer />
<BindingInvalidBanner />
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
