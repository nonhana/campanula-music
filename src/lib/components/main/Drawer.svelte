<script lang='ts'>
  import { page } from '$app/state'
  import Button from '$lib/components/hana/Button.svelte'
  import Drawer from '$lib/components/hana/Drawer.svelte'
  import Logo from '$lib/components/svg/Logo.svelte'
  import { navItems } from '$lib/config'

  interface Props {
    showDetail: boolean
  }

  let { showDetail = $bindable(false) }: Props = $props()

  const currentPath = $derived(page.url.pathname)

  const highlightId = $derived(navItems.findIndex((item) => {
    if (currentPath === item.href)
      return true
    if (item.href !== '/' && currentPath.startsWith(item.href))
      return true
    if (item.href === '/' && currentPath === '/')
      return true
    return false
  }))
</script>

<Drawer bind:visible={showDetail} direction='left'>
  {#snippet icon()}
    <div class='animate-[spin_5s_linear_infinite]'>
      <Logo />
    </div>
  {/snippet}
  <ul class='flex flex-col gap-4'>
    {#each navItems as { title, href, icon: Icon, disabled }, i}
      {#if !disabled}
        <li>
          <Button
            variant='transparent'
            {href}
            activated={highlightId === i}
            aria-label={title}
            class='w-full'
            onclick={() => showDetail = false}
          >
            <span class='flex items-center gap-8 text-lg font-normal'>
              <Icon />
              <p>{title}</p>
            </span>
          </Button>
        </li>
      {/if}
    {/each}
  </ul>
</Drawer>
