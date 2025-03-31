<script lang='ts'>
  import Drawer from '$lib/components/hana/Drawer.svelte'
  import MessageContainer from '$lib/components/hana/MessageContainer.svelte'
  import ScrollContainer from '$lib/components/hana/ScrollContainer.svelte'
  import Header from '$lib/components/main/Header.svelte'
  import Sidebar from '$lib/components/main/Sidebar.svelte'
  import Player from '$lib/components/player/Player.svelte'
  import { setScrolled } from '$lib/stores'
  import { debounce } from 'throttle-debounce'
  import 'uno.css'
  import '@unocss/reset/tailwind.css'

  const { children } = $props()

  let folded = $state(true)

  const toggleFolded = () => {
    folded = !folded
  }

  const toggleScrolled = debounce(100, (e: Event) => {
    const target = e.target as HTMLElement
    setScrolled(target.scrollTop > 0)
  })
</script>

<div class='h-[calc(100vh-5rem)] bg-neutral-100'>
  <ScrollContainer contentClass='flex flex-col' scrollEvents={[toggleScrolled]}>
    <Header {toggleFolded} />
    <Sidebar {folded} />
    <Drawer visible={!folded} direction='left'>
      <div>
        <h1>Hello</h1>
      </div>
    </Drawer>
    <main class={['flex-1', folded ? 'md:ml-20' : 'md:ml-60']}>
      <div class='m-auto px-10 container'>
        {@render children()}
      </div>
    </main>
    <Player />
  </ScrollContainer>
</div>

<!-- 全局消息容器 -->
<MessageContainer />
