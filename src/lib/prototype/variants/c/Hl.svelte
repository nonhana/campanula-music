<!-- PROTOTYPE（变体 C）：即时点亮。命中的字符铺一层薄荷底，不加内边距，不改字重，不引起换行或位移。 -->
<script lang='ts'>
  import { segments } from './search'

  interface Props {
    text: string
    query: string
  }

  const { text, query }: Props = $props()

  const parts = $derived(segments(text, query))
</script>

{#each parts as part, i (i)}{#if part.hit}<mark>{part.text}</mark>{:else}{part.text}{/if}{/each}

<style>
  mark {
    background-color: #d1f1e3;
    color: #1a5b43;
    border-radius: 2px;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
    animation: light-up 180ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes light-up {
    from {
      background-color: rgb(209 241 227 / 0);
    }
  }
</style>
