<script lang='ts'>
  import type { Snippet } from 'svelte'
  import { Eye, EyeOff } from 'lucide-svelte'

  interface Props {
    value?: string
    name?: string
    type?: 'text' | 'textarea' | 'password'
    placeholder?: string
    resize?: 'none' | 'vertical' | 'horizontal' | 'both'
    rows?: number
    shape?: 'rounded' | 'sharp'
    prefixIcon?: Snippet // 前缀 Icon slot
    suffixIcon?: Snippet // 后缀 Icon slot
    keydown?: (e: KeyboardEvent) => void // 键盘敲击事件
  }

  let {
    value = $bindable(),
    name,
    type = 'text',
    placeholder = '',
    resize = 'vertical',
    rows = 5,
    shape = 'sharp',
    prefixIcon,
    suffixIcon,
    keydown,
  }: Props = $props()

  let showPassword = $state(false)

  const togglePassword = () => {
    showPassword = !showPassword
  }

  const curType = $derived(() => {
    if (type === 'textarea')
      return type
    return showPassword ? 'text' : type
  })
</script>

{#if type !== 'textarea'}
  <div class='relative w-full'>
    {#if prefixIcon}
      <span class='absolute top-1/2 -translate-y-1/2 left-3 text-neutral'>
        {@render prefixIcon()}
      </span>
    {/if}
    <input
      bind:value
      {name}
      type={curType()}
      {placeholder}
      onkeydown={keydown}
      class={[
        'w-full py-2 text-sm bg-white placeholder:text-neutral border border-white',
        'focus:ring-2 focus:ring-primary focus:border-transparent',
        shape === 'rounded' ? 'rounded-full' : 'rounded-lg',
        prefixIcon ? 'pl-11' : 'pl-3',
        suffixIcon ? 'pr-11' : 'pr-3',
      ]}
    />
    {#if suffixIcon}
      <span class='absolute top-1/2 -translate-y-1/2 right-3'>
        {@render suffixIcon()}
      </span>
    {/if}
    {#if !suffixIcon && type === 'password'}
      {#if showPassword}
        <EyeOff onclick={togglePassword} />
      {:else}
        <Eye onclick={togglePassword} />
      {/if}
    {/if}
  </div>
{:else}
  <textarea
    bind:value
    {name}
    style:resize={resize}
    {placeholder}
    {rows}
    onkeydown={keydown}
    class={[
      'w-full px-3 py-2 text-sm',
      shape === 'rounded' ? 'rounded-full' : 'rounded-lg',
    ]}
  ></textarea>
{/if}
