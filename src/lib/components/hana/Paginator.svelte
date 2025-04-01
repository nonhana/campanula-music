<script lang='ts'>
  import Button from '$lib/components/hana/Button.svelte'
  import { ChevronLeft, ChevronRight } from 'lucide-svelte'
  import Buttons from './PaginatorButtons.svelte'

  interface Props {
    currentPage: number
    total: number
    pageSize?: number
    buttonCount?: number
    changePage: (page: number) => void
  }

  const {
    currentPage,
    total,
    pageSize = 10,
    buttonCount = 5,
    changePage,
  }: Props = $props()

  let curPage = $state(currentPage)

  $effect(() => {
    changePage(curPage)
  })

  const totalPages = $derived(Math.ceil(total / pageSize) || 1)

  const stepPage = (type: 'prev' | 'next') => {
    if (type === 'prev') {
      curPage = Math.max(1, curPage - 1)
    }
    else {
      curPage = Math.min(totalPages, curPage + 1)
    }
  }

  const goto = (page: number) => {
    curPage = Math.max(1, Math.min(totalPages, page))
  }

  const maxButtonCount = $derived(buttonCount)
  const sideButtonCount = $derived((maxButtonCount - 3) / 2)
</script>

<div class='w-fit flex gap-2'>
  <Button
    class='hidden md:block'
    iconButton
    shape='circle'
    disabled={curPage === 1}
    onclick={() => stepPage('prev')}
  ><ChevronLeft /></Button>
  <Buttons
    currentPage={curPage}
    totalPages={totalPages}
    maxButtonCount={maxButtonCount}
    sideButtonCount={sideButtonCount}
    changePage={goto}
  />
  <Button
    class='hidden md:block'
    iconButton
    shape='circle'
    disabled={curPage === totalPages}
    onclick={() => stepPage('next')}
  ><ChevronRight /></Button>
</div>
