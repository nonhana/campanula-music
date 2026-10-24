<!--
  搜索框（DESIGN.md Inputs · input-search）：纸白底、1px 发丝线、胶囊形、44px 高；有内容时右边清除按钮淡入，
  没有内容时可以放一个提示（顶栏的快捷键）。获得焦点时边框换茎绿、外面一圈 3px 薄荷雾光环；禁用降到 50%。
-->
<script lang='ts'>
  import { Search, X } from '@lucide/svelte'
  import type { Snippet } from 'svelte'
  import type { HTMLInputAttributes } from 'svelte/elements'

  import { fade } from '../shared/motion'
  import { DURATIONS } from '../shared/motion-tokens'

  interface Props extends Omit<HTMLInputAttributes, 'value' | 'type' | 'aria-label'> {
    value: string
    label: string
    input?: HTMLInputElement
    hint?: Snippet
  }

  let { value = $bindable(), label, input = $bindable(), hint, class: klass, disabled, ...rest }: Props = $props()

  const clear = () => {
    value = ''
    input?.focus()
  }
</script>

<div
  class={[
    'h-11 flex items-center gap-3 border border-neutral-200 rounded-full bg-white pl-4 pr-1.5 shadow-ambient transition-[border-color,box-shadow,opacity] duration-feedback focus-within:(border-primary-800 shadow-field-focus)',
    disabled && 'opacity-50',
    klass,
  ]}
>
  <Search size={18} class='flex-none text-neutral-500' aria-hidden='true' />
  <input
    bind:this={input}
    bind:value
    type='search'
    aria-label={label}
    placeholder={label}
    autocomplete='off'
    spellcheck='false'
    class='min-w-0 flex-1 bg-transparent text-body text-neutral-900 outline-none [&::-webkit-search-cancel-button]:hidden disabled:cursor-not-allowed placeholder:text-neutral-500'
    {disabled}
    {...rest}
  />
  <!-- 清除按钮和提示叠在同一格里交叉淡化 -->
  <span class='grid flex-none place-items-center'>
    {#if value && !disabled}
      <button type='button' class='grid col-start-1 row-start-1 size-8 place-items-center rounded-full text-neutral-600 transition-colors duration-feedback mouse:hover:(bg-primary-100 text-primary-950)' aria-label='清除搜索词' onclick={clear} transition:fade={{ duration: DURATIONS.feedback }}>
        <X size={16} aria-hidden='true' />
      </button>
    {:else if hint}
      <span class='col-start-1 row-start-1 flex pr-1.5' transition:fade={{ duration: DURATIONS.feedback }}>{@render hint()}</span>
    {/if}
  </span>
</div>
