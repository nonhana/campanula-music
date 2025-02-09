<script lang='ts'>
  import Container from '$lib/components/hana/Message/Container.svelte'
  import ScrollContainer from '$lib/components/hana/ScrollContainer.svelte'
  import Header from '$lib/components/main/Header.svelte'
  import Sidebar from '$lib/components/main/Sidebar.svelte'
  import Player from '$lib/components/player/Player.svelte'
  import { setScrolled } from '$lib/stores'
  import debounce from 'debounce'
  import '../styles/index.scss'

  const { children } = $props()

  let folded = $state(true)

  const toggleFolded = () => {
    folded = !folded
  }

  const toggleScrolled = debounce((e: Event) => {
    const target = e.target as HTMLElement
    setScrolled(target.scrollTop > 0)
  }, 100)
</script>

<div class='bg-neutral-100 h-[calc(100vh-5rem)]'>
  <ScrollContainer contentClass='flex flex-col' scrollEvents={[toggleScrolled]}>
    <Header {toggleFolded} />
    <Sidebar {folded} />
    <main class={['flex-1', folded ? 'ml-20' : 'ml-60']}>
      <div class='container m-auto'>
        {@render children()}
      </div>
    </main>
    <Player />
  </ScrollContainer>
</div>

<!-- 全局消息容器 -->
<Container />
