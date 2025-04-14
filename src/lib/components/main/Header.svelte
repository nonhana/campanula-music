<script lang='ts'>
  import Button from '$lib/components/hana/Button.svelte'
  import Logo from '$lib/components/svg/Logo.svelte'
  import { scrolled } from '$lib/stores'
  import { Menu } from 'lucide-svelte'

  interface Props {
    toggleFolded: () => void
  }

  const { toggleFolded }: Props = $props()
</script>

<header class={[
  'shrink-0 z-20 sticky top-0 w-full h-16 flex items-center px-5 gap-5 border-b border-primary/0 transition-all',
  $scrolled && 'border-primary/100 bg-white',
]}>
  <Button iconButton variant='transparent' onclick={toggleFolded}>
    <Menu />
  </Button>
  <a href='/' class='animate-[spin_5s_linear_infinite]'><Logo /></a>
  <a href='/' class='text-neutral'>Campanula</a>
</header>
