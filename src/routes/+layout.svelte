<script lang='ts'>
  import MessageContainer from '$lib/components/hana/MessageContainer.svelte'
  import ScrollContainer from '$lib/components/hana/ScrollContainer.svelte'
  import Drawer from '$lib/components/main/Drawer.svelte'
  import Header from '$lib/components/main/Header.svelte'
  import Sidebar from '$lib/components/main/Sidebar.svelte'
  import Player from '$lib/components/player/Player.svelte'
  import { setScrolled } from '$lib/stores'
  import { debounce } from 'throttle-debounce'
  import 'uno.css'
  import '@unocss/reset/tailwind.css'

  const { children } = $props()

  let showDetail = $state(true)

  const toggleFolded = () => {
    showDetail = !showDetail
  }

  const toggleScrolled = debounce(100, (e: Event) => {
    const target = e.target as HTMLElement
    setScrolled(target.scrollTop > 0)
  })
</script>

<div class='h-[calc(100vh-5rem)] bg-neutral-100'>
  <ScrollContainer contentClass='flex flex-col' scrollEvents={[toggleScrolled]}>
    <Header {toggleFolded} />
    <Sidebar folded={!showDetail} />
    <Drawer bind:showDetail={showDetail} />
    <main class={['flex-1', showDetail ? 'md:ml-60' : 'md:ml-20']}>
      <div class='m-auto px-6 container'>
        {@render children()}
      </div>
    </main>
    <Player />
  </ScrollContainer>
</div>

<MessageContainer />
