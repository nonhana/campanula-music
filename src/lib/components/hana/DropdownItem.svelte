<script lang='ts'>
  import type { Pathname } from '$app/types'
  import type { Snippet } from 'svelte'
  import Button from '$lib/components/hana/Button.svelte'

  interface Props {
    href?: Pathname
    command?: string
    center?: boolean
    icon?: Snippet
    children: Snippet
  }

  const {
    href,
    command,
    center = false,
    icon,
    children,
  }: Props = $props()
</script>

<Button
  variant='transparent'
  {href}
  class={['flex gap-2', center ? 'justify-center' : 'justify-start']}
  data-command={command}
>
  {@render icon?.()}
  {@render children()}
</Button>
