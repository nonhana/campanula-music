<script lang='ts'>
  import type { Snippet } from 'svelte'
  import { Eye, EyeOff } from 'lucide-svelte'

  interface Props {
    value?: string
    id?: string
    name?: string
    type?: 'text' | 'textarea' | 'password'
    placeholder?: string
    resize?: 'none' | 'vertical' | 'horizontal' | 'both'
    rows?: number
    shape?: 'rounded' | 'sharp'
    size?: 'sm' | 'md' | 'lg'
    disabled?: boolean
    readonly?: boolean
    required?: boolean
    label?: string
    description?: string
    invalid?: boolean
    error?: string
    class?: string
    prefixIcon?: Snippet
    suffixIcon?: Snippet
    keydown?: (e: KeyboardEvent) => void
  }

  let {
    value = $bindable(),
    id,
    name,
    type = 'text',
    placeholder = '',
    resize = 'vertical',
    rows = 5,
    shape = 'sharp',
    size = 'md',
    disabled = false,
    readonly = false,
    required = false,
    label,
    description,
    invalid = false,
    error,
    class: customClasses = '',
    prefixIcon,
    suffixIcon,
    keydown,
  }: Props = $props()

  const inputId = $derived(id ?? `input-${Math.random().toString(36).slice(2)}`)

  let showPassword = $state(false)

  const togglePassword = () => {
    showPassword = !showPassword
  }

  const curType = $derived.by(() => {
    if (type === 'textarea')
      return type
    return showPassword ? 'text' : type
  })

  const radiusClass = $derived(shape === 'rounded' ? 'rounded-full' : 'rounded-lg')
  const sizeClasses = $derived.by(() => {
    switch (size) {
      case 'sm':
        return type === 'textarea' ? 'px-3 py-2 text-sm' : 'py-1.5 text-sm'
      case 'lg':
        return type === 'textarea' ? 'px-4 py-3 text-base' : 'py-3 text-base'
      default:
        return type === 'textarea' ? 'px-3 py-2 text-sm' : 'py-2 text-sm'
    }
  })

  const fieldBaseClasses = $derived([
    'w-full bg-white border placeholder:text-neutral',
    'focus:outline-none focus:ring-2 focus:border-transparent',
    invalid ? 'border-error-400 focus:ring-error-400' : 'border-neutral-200 hover:border-neutral-300 focus:ring-primary',
    radiusClass,
  ].join(' '))

  const disabledClasses = $derived(disabled ? 'opacity-60 cursor-not-allowed bg-neutral-50' : '')

  const inputPaddingClasses = $derived.by(() => {
    const left = prefixIcon ? 'pl-11' : 'pl-3'
    const right = (suffixIcon || type === 'password') ? 'pr-11' : 'pr-3'
    return `${left} ${right}`
  })
</script>

<div class='w-full {customClasses}'>
  {#if label}
    <label for={inputId} class='mb-1 block text-sm text-neutral-700 font-medium'>{label}</label>
  {/if}

  {#if type !== 'textarea'}
    <div class='relative w-full'>
      {#if prefixIcon}
        <span class='absolute left-3 top-1/2 text-neutral -translate-y-1/2'>
          {@render prefixIcon()}
        </span>
      {/if}
      <input
        id={inputId}
        bind:value
        {name}
        type={curType}
        {placeholder}
        {disabled}
        {readonly}
        {required}
        onkeydown={keydown}
        class={[
          sizeClasses,
          inputPaddingClasses,
          fieldBaseClasses,
          disabledClasses,
        ]}
      />
      {#if suffixIcon}
        <span class='absolute right-3 top-1/2 text-neutral -translate-y-1/2'>
          {@render suffixIcon()}
        </span>
      {:else if type === 'password'}
        <button
          type='button'
          class='absolute right-2.5 top-1/2 rounded-md p-1 text-neutral -translate-y-1/2 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary'
          aria-label={showPassword ? '隐藏密码' : '显示密码'}
          onclick={togglePassword}
        >
          {#if showPassword}
            <EyeOff class='size-5' />
          {:else}
            <Eye class='size-5' />
          {/if}
        </button>
      {/if}
    </div>
  {:else}
    <textarea
      id={inputId}
      bind:value
      {name}
      style:resize={resize}
      {placeholder}
      {rows}
      {disabled}
      {readonly}
      {required}
      onkeydown={keydown}
      class={[
        sizeClasses,
        fieldBaseClasses,
        disabledClasses,
      ]}
    ></textarea>
  {/if}

  {#if invalid && error}
    <p class='mt-1 text-xs text-error-600'>{error}</p>
  {:else if description}
    <p class='mt-1 text-xs text-neutral'>{description}</p>
  {/if}
</div>
