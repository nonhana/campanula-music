<script lang='ts'>
  import Button from '$lib/components/hana/Button.svelte'
  import { Ellipsis } from 'lucide-svelte'

  interface Props {
    currentPage: number
    totalPages: number
    maxButtonCount: number
    sideButtonCount: number
    changePage: (page: number) => void
  }

  const {
    currentPage,
    totalPages,
    maxButtonCount,
    sideButtonCount,
    changePage,
  }: Props = $props()

  const isCompact = $derived(totalPages > maxButtonCount)
  const sanitizedCurrentPage = $derived(Math.max(1, Math.min(currentPage, totalPages)))

  const start = $derived.by(() => {
    if (!isCompact)
      return 1
    if (sanitizedCurrentPage > totalPages - maxButtonCount + 2)
      return totalPages - maxButtonCount + 2
    return Math.max(sanitizedCurrentPage - sideButtonCount, 2)
  })

  const end = $derived.by(() => {
    if (!isCompact)
      return totalPages
    if (sanitizedCurrentPage + 1 < maxButtonCount - 1)
      return maxButtonCount - 1
    return Math.min(sanitizedCurrentPage + sideButtonCount, totalPages - 1)
  })

  const pages = $derived.by(() => {
    const pages: number[] = []
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    return pages
  })
</script>

{#if start !== 1}
  <Button
    iconButton
    activated={currentPage === 1}
    shape='circle'
    onclick={() => changePage(1)}
  ><span>1</span></Button>
{/if}
{#if start > 2}
  <Button iconButton shape='circle'><Ellipsis /></Button>
{/if}
{#each pages as page}
  <Button
    iconButton
    activated={currentPage === page}
    shape='circle'
    onclick={() => changePage(page)}
  ><span>{page}</span></Button>
{/each}
{#if end < totalPages - 1}
  <Button iconButton shape='circle'><Ellipsis /></Button>
{/if}
{#if end !== totalPages && totalPages > 1}
  <Button
    iconButton
    activated={currentPage === totalPages}
    shape='circle'
    onclick={() => changePage(totalPages)}
  ><span>{totalPages}</span></Button>
{/if}
