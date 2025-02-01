<script lang='ts'>
  import Button from '$lib/components/hana/Button.svelte'
  import Input from '$lib/components/hana/Input.svelte'
  import Logo from '$lib/components/svg/Logo.svelte'
  import { siteTitle } from '$lib/config'
  import { scrolled } from '$lib/stores/scrolled'
  import { Menu, Search } from 'lucide-svelte'

  interface Props {
    toggleFolded: () => void
  }

  const { toggleFolded }: Props = $props()

  let keywords = $state('')
</script>

<header class={[
  'sticky top-0 w-full h-16 flex items-center px-5 gap-5 border-b border-primary border-opacity-0 transition-all',
  $scrolled && 'border-opacity-100 bg-white',
]}>
  <Button iconButton variant='transparent' onclick={toggleFolded}>
    <Menu />
  </Button>
  <span class='w-40 flex gap-1 items-center cursor-pointer'><Logo />{siteTitle}</span>
  <div class='max-w-96'>
    <Input bind:value={keywords} placeholder='请输入你想搜索的内容~' shape='rounded'>
      {#snippet prefixIcon()}
        <Search size={20} />
      {/snippet}
    </Input>
  </div>
</header>
