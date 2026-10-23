<!--
  桌面顶栏右边的头像（视觉原型 DesktopShell）：点开是账号菜单，显示头像和昵称，可以去设置、退出登录（先确认：LogoutConfirm，关上后焦点回到头像）。
  菜单从头像下面飘出来，关上时淡出（DESIGN.md Overlays，motion.ts 的 pop）；连点头像时从此刻的样子掉头，不留残影。
  键盘：Enter / 空格 / ↓ 打开并聚焦第一项，↑↓ 在菜单项之间移动，Esc 关上并回到头像，Tab 离开时关上。
-->
<script lang='ts'>
  import type { Account } from '#lib/api/account.js'
  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'
  import { LogOut, Settings } from '@lucide/svelte'
  import Avatar from '../Avatar.svelte'
  import { pop } from '../motion'
  import { getOverlays } from '../overlay-context'

  const { account }: { account: Account } = $props()
  const { logoutConfirm } = getOverlays()

  let open = $state(false)
  let root = $state<HTMLElement>()
  let trigger = $state<HTMLButtonElement>()
  let menu = $state<HTMLElement>()

  const items = () => [...(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]

  function show(focus: 'first' | 'last') {
    open = true
    queueMicrotask(() => (focus === 'first' ? items()[0] : items().at(-1))?.focus())
  }

  function hide(returnFocus: boolean) {
    open = false
    if (returnFocus)
      trigger?.focus()
  }

  function onTriggerKey(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      show(event.key === 'ArrowDown' ? 'first' : 'last')
    }
  }

  function onMenuKey(event: KeyboardEvent) {
    const list = items()
    const at = list.indexOf(document.activeElement as HTMLElement)
    if (event.key === 'Escape') {
      event.preventDefault()
      hide(true)
    }
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      list[(at + step + list.length) % list.length]?.focus()
    }
    else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      ;(event.key === 'Home' ? list[0] : list.at(-1))?.focus()
    }
    else if (event.key === 'Tab') {
      hide(false)
    }
  }

  // 点菜单外面就关上
  function onPointerDown(event: PointerEvent) {
    if (open && !root?.contains(event.target as Node))
      hide(false)
  }

  function openSettings() {
    hide(false)
    void goto(resolve('/settings'))
  }

  function confirmLogout() {
    hide(false)
    logoutConfirm.open({ from: trigger ?? null })
  }
</script>

<svelte:window onpointerdown={onPointerDown} />

<div bind:this={root} class='relative flex-none'>
  <button
    bind:this={trigger}
    type='button'
    class='press rounded-full transition-transform duration-move-feedback mouse:hover:brightness-95'
    aria-label='账号：{account.nickname}'
    aria-haspopup='menu'
    aria-expanded={open}
    aria-controls={open ? 'account-menu' : undefined}
    onclick={() => (open ? hide(false) : show('first'))}
    onkeydown={onTriggerKey}
  >
    <Avatar url={account.avatarUrl} size={36} class='ring-2 ring-white' />
  </button>

  {#if open}
    <div
      bind:this={menu}
      id='account-menu'
      role='menu'
      aria-label='账号'
      tabindex='-1'
      class='absolute right-0 top-[calc(100%+8px)] z-50 w-64 origin-top-right rounded-xl bg-white p-2 shadow-float'
      transition:pop={{ below: true }}
      onkeydown={onMenuKey}
    >
      <div class='flex items-center gap-3 px-2 pb-3 pt-1.5'>
        <Avatar url={account.avatarUrl} size={40} />
        <p class='min-w-0 truncate text-label text-neutral-900 font-500'>{account.nickname}</p>
      </div>
      <div class='mb-1 h-px bg-neutral-100' role='separator'></div>
      <button type='button' role='menuitem' tabindex='-1' class='h-10 w-full flex items-center gap-3 rounded-lg px-2 text-left text-label text-neutral-800 focus-visible:bg-primary-100 mouse:hover:bg-primary-100' onclick={openSettings}>
        <Settings size={18} class='text-neutral-600' aria-hidden='true' />设置
      </button>
      <button type='button' role='menuitem' tabindex='-1' class='h-10 w-full flex items-center gap-3 rounded-lg px-2 text-left text-label text-neutral-800 focus-visible:bg-primary-100 mouse:hover:bg-primary-100' onclick={confirmLogout}>
        <LogOut size={18} class='text-neutral-600' aria-hidden='true' />退出登录
      </button>
    </div>
  {/if}
</div>
