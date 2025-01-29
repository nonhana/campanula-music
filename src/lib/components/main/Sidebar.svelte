<script lang='ts'>
  import Button from '$lib/components/hana/Button.svelte'
  import { navItems } from '$lib/config.svelte'

  interface Props {
    folded: boolean
  }

  const { folded }: Props = $props()
</script>

<nav class={['h-[100dvh-16rem]', folded ? 'w-20' : 'w-60']}>
  <ul class='flex flex-col gap-2'>
    {#each navItems as { title, href, icon: Icon }}
      <li class={['flex', folded ? 'justify-center' : 'justify-start ml-3']}>
        <Button
          iconButton={folded}
          variant='transparent'
          {href}
          ariaLabel={title}
          class={folded ? '' : 'block'}
        >
          <span class='flex items-center text-sm font-normal space-x-2'>
            <Icon />
            <p class={folded ? 'hidden' : 'block'}>{title}</p>
          </span>
        </Button>
      </li>
    {/each}
  </ul>
</nav>
