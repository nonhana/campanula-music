<script lang='ts'>
  import Button from '$lib/components/hana/Button.svelte'
  import { ChevronLeft, ChevronRight } from 'lucide-svelte'
  import Buttons from './Buttons.svelte'

  interface Props {
    total: number
    pageSize?: number
    buttonCount?: number
  }

  const {
    total,
    pageSize = 10,
    buttonCount = 5,
  }: Props = $props()

  const totalPages = $derived(Math.ceil(total / pageSize) || 1)

  let currentPage = $state(1)

  const stepPage = (type: 'prev' | 'next') => {
    if (type === 'prev') {
      currentPage = Math.max(1, currentPage - 1)
    }
    else {
      currentPage = Math.min(totalPages, currentPage + 1)
    }
  }

  const goto = (page: number) => {
    currentPage = Math.max(1, Math.min(totalPages, page))
  }

  const maxButtonCount = $derived(buttonCount)
  const sideButtonCount = $derived((maxButtonCount - 3) / 2)
</script>

<div class='w-fit gap-2 flex'>
  <Button
    iconButton
    shape='circle'
    disabled={currentPage === 1}
    onclick={() => stepPage('prev')}
  ><ChevronLeft /></Button>
  <Buttons
    currentPage={currentPage}
    totalPages={totalPages}
    maxButtonCount={maxButtonCount}
    sideButtonCount={sideButtonCount}
    changePage={goto}
  />
  <Button
    iconButton
    shape='circle'
    disabled={currentPage === totalPages}
    onclick={() => stepPage('next')}
  ><ChevronRight /></Button>
</div>
