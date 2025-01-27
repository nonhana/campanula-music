<script lang='ts'>
  import '../styles/index.scss'

  const { children } = $props()
</script>

<div class='layout'>
  <header class='header'>
    <h1>这是 header 的内容哦~</h1>
  </header>

  <main>
    {@render children()}
  </main>

  <footer>
    <p>这是 footer 的内容哦~</p>
  </footer>
</div>
