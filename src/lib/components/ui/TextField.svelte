<!--
  表单输入框（DESIGN.md Inputs）：歌单名称、手机号、验证码这类。纸白底、1px 发丝线、12px 圆角，44px 高，
  标签在上面。获得焦点时边框换成茎绿，外面一圈 3px 薄荷雾光环；出错时边框和说明文字用出错红；禁用降到 50%。
-->
<script lang='ts'>
  import type { HTMLInputAttributes } from 'svelte/elements'

  interface Props extends Omit<HTMLInputAttributes, 'value' | 'id'> {
    id: string
    value: string
    label: string
    /** 说清楚哪里不对、怎么改；有它时输入框标成出错 */
    error?: string
  }

  let { id, value = $bindable(), label, error, class: klass, ...rest }: Props = $props()
</script>

<div class={['flex flex-col', klass]}>
  <label for={id} class='text-caption text-neutral-700 font-500'>{label}</label>
  <input
    {id}
    bind:value
    aria-invalid={error ? 'true' : undefined}
    aria-describedby={error ? `${id}-error` : undefined}
    class={[
      'mt-1.5 h-11 w-full border rounded-lg bg-white px-3.5 text-body text-neutral-900 outline-none transition-[border-color,box-shadow] duration-120 disabled:(cursor-not-allowed opacity-50) placeholder:text-neutral-500',
      // 获得焦点时边框加粗成 2px：茎绿（出错时仍是出错红），外面一圈 3px 的浅色光环
      error
        ? 'border-error-700 focus:shadow-field-focus-error'
        : 'border-neutral-200 focus:(border-primary-800 shadow-field-focus)',
    ]}
    {...rest}
  />
  {#if error}
    <p id='{id}-error' class='mt-1.5 text-caption text-error-700'>{error}</p>
  {/if}
</div>
