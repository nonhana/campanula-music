<script lang='ts'>
  import AppNav from '$lib/components/app/AppNav.svelte'
  import LoadingIndicator from '$lib/components/main/LoadingIndicator.svelte'
  import { initSkin } from '$lib/skin'
  import { onMount } from 'svelte'
  import '$lib/skin/skins.css'
  import 'uno.css'
  import '@unocss/reset/tailwind.css'

  const { children } = $props()

  onMount(initSkin)
</script>

<LoadingIndicator />

<div class='flex flex-col bg-app-bg text-app-text min-h-dvh md:pl-60'>
  <AppNav />
  <main class='flex-1'>
    <div class='mx-auto max-w-5xl w-full px-4 pb-24 pt-6 md:px-8 md:pb-12 md:pt-10'>
      {@render children()}
    </div>
  </main>
</div>
