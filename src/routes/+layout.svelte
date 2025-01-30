<script lang='ts'>
  import Header from '$lib/components/main/Header.svelte'
  import Sidebar from '$lib/components/main/Sidebar.svelte'
  import { setScrolled } from '$lib/stores/scrolled'
  import debounce from 'debounce'
  import { onMount } from 'svelte'
  import '../styles/index.scss'

  const { children } = $props()

  let folded = $state(true)

  const toggleFolded = () => {
    folded = !folded
  }

  const toggleScrolled = debounce(() => setScrolled(window.scrollY > 0), 100)
  onMount(() => {
    window.addEventListener('scroll', toggleScrolled)
    return () => window.removeEventListener('scroll', toggleScrolled)
  })
</script>

<div class='flex flex-col min-h-dvh h-[2000px] bg-primary-100'>
  <Header {toggleFolded} />
  <Sidebar {folded} />
  <main class={['flex-1', folded ? 'ml-20' : 'ml-60']}>
    {@render children()}
  </main>
  <footer>
    <p>这是 footer 的内容哦~</p>
  </footer>
</div>
