<!--
  专辑简介：桌面是头部下面的一段灰字（截断 3 行），手机放在白色圆角卡片里（截断 4 行）。
  截断了才有“展开 / 收起”按钮（量出来的：文字不够行数时不显示）
-->
<script lang='ts'>
  import { langOf } from './view'

  interface Props {
    text: string
    phone?: boolean
  }

  const { text, phone = false }: Props = $props()
  const textId = $props.id()
  let expanded = $state(false)
  let clipped = $state(false)
  let paragraph = $state<HTMLElement>()

  // 收起时看文字有没有被截断；换了简介、窗口变宽变窄都要重新量
  $effect(() => {
    void text
    if (!paragraph || expanded)
      return
    const element = paragraph
    const measure = () => {
      clipped = element.scrollHeight > element.clientHeight + 1
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  })
</script>

<section class={phone ? 'px-4 pt-4' : 'mt-6 max-w-[500px]'} aria-label='简介'>
  <div class={[phone && 'rounded-xl bg-white p-4 shadow-ambient']}>
    <p
      bind:this={paragraph}
      id={textId}
      class={['whitespace-pre-line break-words text-neutral-600', phone ? 'text-caption' : 'text-label', !expanded && (phone ? 'line-clamp-4' : 'line-clamp-3')]}
      lang={langOf(text)}
    >{text}</p>
    {#if clipped || expanded}
      <button
        type='button'
        class='mt-1 min-h-8 rounded text-caption text-primary-900 font-500 mouse:hover:underline'
        aria-expanded={expanded}
        aria-controls={textId}
        onclick={() => (expanded = !expanded)}
      >
        {expanded ? '收起' : '展开'}
      </button>
    {/if}
  </div>
</section>
