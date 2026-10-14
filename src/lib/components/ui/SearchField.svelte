<!--
  搜索框（DESIGN.md Inputs · input-search）：顶栏搜索、歌单内搜索。纸白底、1px 发丝线、胶囊形，44px 高；
  左边搜索图标，有内容时右边出现清除按钮。获得焦点时边框换成茎绿，外面一圈 3px 薄荷雾光环。
-->
<script lang='ts'>
  import type { HTMLInputAttributes } from 'svelte/elements'
  import { Search, X } from '@lucide/svelte'

  interface Props extends Omit<HTMLInputAttributes, 'value' | 'type' | 'aria-label'> {
    value: string
    /** 读屏读出的名字，也是没有内容时的提示 */
    label: string
  }

  let { value = $bindable(), label, class: klass, disabled, ...rest }: Props = $props()
  let input = $state<HTMLInputElement>()

  function clear() {
    value = ''
    input?.focus()
  }
</script>

<div
  class={[
    'h-11 flex items-center gap-3 border border-neutral-200 rounded-full bg-white pl-4 pr-1.5 shadow-ambient transition-[border-color,box-shadow] duration-feedback focus-within:(border-primary-800 shadow-field-focus)',
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
  {#if value && !disabled}
    <button type='button' class='grid size-8 flex-none place-items-center rounded-full text-neutral-600 mouse:hover:(bg-primary-100 text-primary-950)' aria-label='清除搜索词' onclick={clear}>
      <X size={16} aria-hidden='true' />
    </button>
  {/if}
</div>
