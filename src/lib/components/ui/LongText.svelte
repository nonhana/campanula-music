<!--
  长文的一段（歌手页的简介、歌单和专辑简介的阅读层）：Body、行高放松到 28px、石墨字；保留作者写的换行，长单词折行，按文字带 lang
  （DESIGN.md Layout · 歌手页 · 简介）。
-->
<script lang='ts'>
  import type { ClassValue } from 'svelte/elements'

  import { langOf } from '../shared/text'

  interface Props {
    text: string
    class?: ClassValue
  }

  const { text, class: klass }: Props = $props()
</script>

<p class={['whitespace-pre-line break-words text-body text-neutral-700 leading-7', klass]} lang={langOf(text)}>{text}</p>
