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

  const totalPages = $derived(Math.ceil(total / pageSize) || 1)

  const goto = (page: number) => {
    changePage(Math.max(1, Math.min(totalPages, page)))
  }

  const stepPage = (type: 'prev' | 'next') => {
    if (type === 'prev') {
      goto(currentPage - 1)
    }
    else {
      goto(currentPage + 1)
    }
  }

  const sideButtonCount = $derived((buttonCount - 3) / 2)
</script>

<div class='w-fit flex gap-2'>
  <Button
    class='hidden md:block'
    iconButton
    shape='circle'
    disabled={currentPage === 1}
    onclick={() => stepPage('prev')}
  ><ChevronLeft /></Button>
  <Buttons
    {currentPage}
    totalPages={totalPages}
    maxButtonCount={buttonCount}
    sideButtonCount={sideButtonCount}
    changePage={goto}
  />
  <Button
    class='hidden md:block'
    iconButton
    shape='circle'
    disabled={currentPage === totalPages}
    onclick={() => stepPage('next')}
  ><ChevronRight /></Button>
</div>
