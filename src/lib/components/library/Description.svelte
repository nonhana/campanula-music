<!--
  专辑、歌单的简介（专辑页和歌单页共用）：桌面是头部下面一段灰字（3 行），手机在白色圆角卡片里（4 行）；截断了才有“展开 / 收起”。
  展开、收起时高度从现在的样子变过去（展开 360ms、收起 200ms），下面的歌平稳地挪；连点时从此刻的高度掉头，收起时等高度收完才截断。
-->
<script lang='ts'>
  import { flushSync } from 'svelte'

  import { animateHeight } from '../shared/motion'
  import { DURATIONS } from '../shared/motion-tokens'
  import { langOf } from '../shared/text'

  interface Props {
    text: string
    phone?: boolean
  }

  const { text, phone = false }: Props = $props()
  const textId = $props.id()
  let expanded = $state(false)
  /** 高度收完才截断，收的这一会儿字不先变省略号 */
  let folding = $state(false)
  let clipped = $state(false)
  let paragraph = $state<HTMLElement>()
  let resizing: Animation | undefined
  const clamped = $derived(!expanded && !folding)

  // 换了简介、窗口变宽变窄都要重新量
  $effect(() => {
    void text
    if (!paragraph || !clamped)
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

  const toggle = () => {
    const element = paragraph!
    const from = element.getBoundingClientRect().height
    resizing?.cancel()
    expanded = !expanded
    folding = !expanded
    flushSync()
    const lines = phone ? 4 : 3
    const to = expanded
      ? element.scrollHeight
      : Number.parseFloat(getComputedStyle(element).lineHeight) * lines
    const animation = animateHeight(element, from, to, expanded ? DURATIONS.panel : DURATIONS['panel-out'])
    resizing = animation ?? undefined
    if (!animation) {
      folding = false
      return
    }
    animation.finished.then(() => {
      if (resizing === animation) {
        resizing = undefined
        folding = false
      }
    }, () => {})
  }
</script>

<section class={phone ? 'px-4 pt-4' : 'mt-6 max-w-[500px]'} aria-label='简介'>
  <div class={[phone && 'rounded-xl bg-white p-4 shadow-ambient']}>
    <p
      bind:this={paragraph}
      id={textId}
      class={[
        'whitespace-pre-line break-words text-neutral-600',
        phone ? 'text-caption' : 'text-label',
        clamped && (phone ? 'line-clamp-4' : 'line-clamp-3'),
      ]}
      lang={langOf(text)}
    >{text}</p>
    {#if clipped || expanded}
      <button
        type='button'
        class='mt-1 min-h-8 rounded text-caption text-primary-900 font-500 mouse:hover:underline'
        aria-expanded={expanded}
        aria-controls={textId}
        onclick={toggle}
      >
        {expanded ? '收起' : '展开'}
      </button>
    {/if}
  </div>
</section>
