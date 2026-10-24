<!--
  表单输入框（DESIGN.md Inputs）：歌单名称、手机号、验证码这类。纸白底、1px 发丝线、12px 圆角，44px 高，
  标签在上面（右边可以带一段说明，例如歌单名称的字数），可以带一段固定的前缀（例如手机号的 +86），右边可以跟一个按钮（例如“获取验证码”）。
  获得焦点时边框换成茎绿，外面一圈 3px 薄荷雾光环；出错时边框和说明文字用出错红；禁用降到 50%。
  下面的报错、提示推开下面的内容：出现时展开、收起时淡出再收（motion.ts 的 unfold），报错和提示之间换的时候一个收一个展
-->
<script lang='ts'>
  import type { Snippet } from 'svelte'
  import type { HTMLInputAttributes } from 'svelte/elements'
  import { unfold } from '../shared/motion'

  interface Props extends Omit<HTMLInputAttributes, 'value' | 'id' | 'prefix'> {
    id: string
    value: string
    label: string
    /** 输入框里左边固定的一段，不能改，例如 +86 */
    prefix?: string
    /** 说清楚哪里不对、怎么改；有它时输入框标成出错 */
    error?: string
    /** 输入框下面的提示（没出错时显示），例如“验证码已发到……” */
    hint?: string
    /** 拿到 input 元素，用来移焦点 */
    input?: HTMLInputElement
    /** 输入框右边跟着的按钮，和输入框一样高 */
    action?: Snippet
    /** 标签那一行右边的说明，例如歌单名称写了多少（“12/40”） */
    aside?: string
  }

  let { id, value = $bindable(), label, prefix, error, hint, input = $bindable(), action, aside, class: klass, disabled, ...rest }: Props = $props()
  const note = $derived(error
    ? `${id}-error`
    : hint
    ? `${id}-hint`
    : undefined)
</script>

<div class={['flex flex-col', klass]}>
  <div class='flex items-baseline justify-between gap-3'>
    <label for={id} class='text-caption text-neutral-700 font-500'>{label}</label>
    {#if aside}<span class={[
      'text-caption tabular-nums',
      error ? 'text-error-700' : 'text-neutral-600',
    ]}>{aside}</span>{/if}
  </div>
  <div class='mt-1.5 flex gap-2'>
    <div
      class={[
        'h-11 min-w-0 flex flex-1 items-center border rounded-lg bg-white transition-[border-color,box-shadow,opacity] duration-feedback',
        // 获得焦点时边框加粗成 2px：茎绿（出错时仍是出错红），外面一圈 3px 的浅色光环
        error
          ? 'border-error-700 focus-within:shadow-field-focus-error'
          : 'border-neutral-200 focus-within:(border-primary-800 shadow-field-focus)',
        disabled && 'opacity-50',
      ]}
    >
      {#if prefix}
        <span class='h-5 flex flex-none items-center border-r border-neutral-200 pl-3.5 pr-3 text-body text-neutral-900 tabular-nums' aria-hidden='true'>{prefix}</span>
      {/if}
      <input
        {id}
        bind:this={input}
        bind:value
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={note}
        class='h-full min-w-0 flex-1 rounded-lg bg-transparent px-3.5 text-body text-neutral-900 outline-none disabled:cursor-not-allowed placeholder:text-neutral-500'
        {disabled}
        {...rest}
      />
    </div>
    {@render action?.()}
  </div>
  {#if error}
    <div transition:unfold>
      <p id='{id}-error' class='pt-1.5 text-caption text-error-700'>{error}</p>
    </div>
  {:else if hint}
    <div transition:unfold>
      <p id='{id}-hint' class='pt-1.5 text-caption text-neutral-600' role='status'>{hint}</p>
    </div>
  {/if}
</div>
