<script lang='ts'>
  import MessageContainer from '$lib/components/hana/MessageContainer.svelte'
  import ScrollContainer from '$lib/components/hana/ScrollContainer.svelte'
  import Drawer from '$lib/components/main/Drawer.svelte'
  import Header from '$lib/components/main/Header.svelte'
  import LoadingIndicator from '$lib/components/main/LoadingIndicator.svelte'
  import Sidebar from '$lib/components/main/Sidebar.svelte'
  import Player from '$lib/components/player/Player.svelte'
  import { setScrolled } from '$lib/stores'
  import { throttle } from 'throttle-debounce'
  import 'uno.css'
  import '@unocss/reset/tailwind.css'

  const { children } = $props()

  let showDetail = $state(false)

  const toggleFolded = () => {
    showDetail = !showDetail
  }

  const toggleScrolled = throttle(100, (e: Event) => {
    const target = e.target as HTMLElement
    setScrolled(target.scrollTop > 0)
  })
</script>

<LoadingIndicator />

<div class='h-[calc(100dvh-5rem)] bg-neutral-100'>
  <ScrollContainer contentClass='flex flex-col' scrollEvents={[toggleScrolled]}>
    <Header {toggleFolded} />
    <Sidebar folded={!showDetail} />
    <div class='block md:hidden'>
      <Drawer bind:showDetail={showDetail} />
    </div>
    <main class={['flex-1', showDetail ? 'md:ml-60' : 'md:ml-20']}>
      <div class='m-auto px-6 container'>
        {@render children()}
      </div>
    </main>
    <Player />
  </ScrollContainer>
</div>

<MessageContainer />
