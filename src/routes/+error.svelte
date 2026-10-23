<script lang='ts'>
  import type { ErrorProps } from './$types'
  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'
  import StateBlock from '#lib/components/ui/StateBlock.svelte'

  const { error }: ErrorProps = $props()
  const title = $derived(error.status === 404 ? '没有这个页面' : '没能打开这个页面')
</script>

<svelte:head><title>{title} · Campanula</title></svelte:head>

<h1 class='sr-only'>{title}</h1>
<StateBlock kind='error' {title} action={{ label: '回到曲库', run: () => void goto(resolve('/')) }} />
