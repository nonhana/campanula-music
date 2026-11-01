<!--
  歌单、专辑简介的预览（DetailHeader 摆它）：桌面是页头里标签下面的一行灰字，手机是页头最下面白色卡片里的两行；放不下时整行（整张卡片）
  能点，末尾一个 ›，点开阅读层（DescriptionDialog）读全文。放得下就只是字，不能点。页面不会因为简介变高，歌曲列表一直紧跟页头。
-->
<script lang='ts'>
  import { ChevronRight } from '@lucide/svelte'

  import { getOverlays } from '../overlay/overlay-context'
  import { langOf } from '../shared/text'

  interface Props {
    text: string
    /** 歌单名或专辑名：阅读层的副标题 */
    name: string
    phone?: boolean
  }

  const { text, name, phone = false }: Props = $props()
  const { descriptionDialog } = getOverlays()
  let preview = $state<HTMLElement>()
  let clipped = $state(false)

  // 换了简介、窗口变宽变窄都要重新量；能点时多了 ›，字的宽度只会更窄，量出来不会来回跳
  $effect(() => {
    void text
    const element = preview
    if (!element)
      return
    const measure = () => {
      clipped = phone
        ? element.scrollHeight > element.clientHeight + 1
        : element.scrollWidth > element.clientWidth + 1
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  })

  const open = (event: MouseEvent) => descriptionDialog.open({
    name,
    text,
    from: event.currentTarget as HTMLElement,
  })
</script>

{#snippet line(classes: string)}
  <span bind:this={preview} class={['min-w-0', classes]} lang={langOf(text)}>{text}</span>
{/snippet}

<section aria-label='简介'>
  {#if phone && clipped}
    <button
      type='button'
      class='w-full flex items-center gap-3 rounded-xl bg-white p-4 text-left text-neutral-600 shadow-ambient'
      aria-haspopup='dialog'
      aria-label='查看简介'
      onclick={open}
    >
      {@render line('flex-1 line-clamp-2 whitespace-pre-line break-words text-caption')}
      <ChevronRight size={18} class='flex-none text-neutral-500' aria-hidden='true' />
    </button>
  {:else if phone}
    <p class='flex rounded-xl bg-white p-4 text-left text-neutral-600 shadow-ambient'>
      {@render line('flex-1 line-clamp-2 whitespace-pre-line break-words text-caption')}
    </p>
  {:else if clipped}
    <button
      type='button'
      class='h-7 max-w-full flex items-center gap-1 rounded text-left text-label text-neutral-600 transition-colors duration-feedback mouse:hover:text-neutral-900'
      aria-haspopup='dialog'
      aria-label='查看简介'
      onclick={open}
    >
      {@render line('truncate')}
      <ChevronRight size={16} class='flex-none' aria-hidden='true' />
    </button>
  {:else}
    <p class='h-7 flex items-center text-label text-neutral-600'>{@render line('truncate')}</p>
  {/if}
</section>
