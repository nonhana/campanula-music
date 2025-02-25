<script lang='ts'>
  import { page } from '$app/state'
  import Button from '$lib/components/hana/Button.svelte'
  import Tooltip from '$lib/components/hana/Tooltip.svelte'
  import { navItems } from '$lib/config'
  import { scrolled } from '$lib/stores'

  interface Props {
    folded: boolean
  }

  const { folded }: Props = $props()

  const highlightId = $derived(navItems.findIndex(item => item.href === page.route.id))
</script>

<nav class={[
  'z-20 fixed top-16 h-[calc(100dvh-4rem)] border-r border-primary/0 transition-all',
  folded ? 'w-20' : 'w-60',
  $scrolled && 'bg-white border-primary/100',
]}>
  <ul class='flex flex-col gap-2'>
    {#each navItems as { title, href, icon: Icon }, i}
      <li class={['flex', folded ? 'justify-center' : 'justify-start ml-3']}>
        <Tooltip content={title} position='right' disabled={!folded}>
          <Button
            iconButton={folded}
            variant='transparent'
            activated={highlightId === i}
            {href}
            aria-label={title}
            style={folded ? undefined : 'width: 13.5rem'}
          >
            <span class='flex items-center gap-4 text-sm font-normal'>
              <Icon />
              <p class={folded ? 'hidden' : 'block'}>{title}</p>
            </span>
          </Button>
        </Tooltip>
      </li>
    {/each}
  </ul>
</nav>
