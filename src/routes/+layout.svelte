<script lang='ts'>
  import Header from '$lib/components/main/Header.svelte'
  import Sidebar from '$lib/components/main/Sidebar.svelte'
  import '../styles/index.scss'

  const { children } = $props()

  let folded = $state(false)

  const toggleFolded = () => {
    folded = !folded
  }
</script>

<div class='flex flex-col min-h-dvh bg-gradient-to-br from-primary-100 to-primary'>
  <Header {toggleFolded} />
  <main class='flex-1 flex flex-row'>
    <Sidebar {folded} />
    {@render children()}
  </main>
  <footer>
    <p>这是 footer 的内容哦~</p>
  </footer>
</div>
