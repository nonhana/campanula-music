<script lang='ts'>
  import AppNav from '$lib/components/app/AppNav.svelte'
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
  })
</script>

<LoadingIndicator />
<MessageContainer />

<Player />

<div class='flex flex-col bg-app-bg text-app-text min-h-dvh md:pl-60'>
  <AppNav />
  <main class='flex-1'>
    <div class='mx-auto max-w-5xl w-full px-4 pb-40 pt-6 md:px-8 md:pb-28 md:pt-10'>
      {@render children()}
    </div>
  </main>
</div>
