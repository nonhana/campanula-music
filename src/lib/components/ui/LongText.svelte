<script lang="ts">
  import type { ClassValue } from 'svelte/elements';

  import { langOf } from '../shared/text';

  interface Props {
    text: string;
    class?: ClassValue;
  }

  const { text, class: klass }: Props = $props();
</script>

<p
  class={[
    'whitespace-pre-line break-words text-body text-neutral-700 leading-7',
    klass,
  ]}
  lang={langOf(text)}
>
  {text}
</p>
