<script lang='ts'>
  import { page } from '$app/state'
  import Button from '$lib/components/hana/Button.svelte'
  import Tooltip from '$lib/components/hana/Tooltip.svelte'
  import { navItems } from '$lib/config.svelte'

  interface Props {
    folded: boolean
  }

  const { folded }: Props = $props()

  const highlightId = $derived(navItems.findIndex(item => item.href === page.route.id))
</script>

<nav class={['h-[100dvh-16rem]', folded ? 'w-20' : 'w-60']}>
  <ul class='flex flex-col gap-2'>
    {#each navItems as { title, href, icon: Icon }, i}
      <li class={['flex', folded ? 'justify-center' : 'justify-start ml-3']}>
        <Tooltip content={title} position='right' disabled={!folded}>
          <Button
            iconButton={folded}
            variant='transparent'
            activated={highlightId === i}
            {href}
            ariaLabel={title}
            style={folded ? undefined : 'width: 13.5rem'}
          >
            <span class='flex items-center text-sm font-normal space-x-2'>
              <Icon />
              <p class={folded ? 'hidden' : 'block'}>{title}</p>
            </span>
          </Button>
        </Tooltip>
      </li>
    {/each}
  </ul>
</nav>
