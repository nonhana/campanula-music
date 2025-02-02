<script lang='ts'>
  import Footer from '$lib/components/main/Footer.svelte'
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

<div class='flex flex-col min-h-dvh h-[2000px] bg-neutral-100'>
  <Header {toggleFolded} />
  <Sidebar {folded} />
  <main class={['flex-1 m-auto container']}>
    {@render children()}
  </main>
  <Footer />
</div>
