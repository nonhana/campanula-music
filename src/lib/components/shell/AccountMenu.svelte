<!--
  桌面顶栏右边的头像（视觉原型 DesktopShell）：点开是账号菜单，显示头像和昵称，可以去设置、退出登录（先确认：LogoutConfirm，关上后焦点回到头像）；菜单从头像下面飘出来，关上时淡出（DESIGN.md Overlays，motion.ts 的 pop）。
  键盘：Enter / 空格 / ↓ 打开并聚焦第一项，↑↓ 在菜单项之间移动，Esc 关上并回到头像，Tab 离开时关上；行怎么画、行高和 ↑↓ / Home / End 由 MenuList 管（#73）。
-->
<script lang='ts'>
  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'
  import { LogOut, Settings } from '@lucide/svelte'

  import type { Account } from '#lib/api/account.js'

  import Avatar from '../account/Avatar.svelte'
  import type { MenuItem } from '../menu/menu'
  import MenuList from '../menu/MenuList.svelte'
  import { getOverlays } from '../overlay/overlay-context'
  import { pop } from '../shared/motion'

  const { account }: { account: Account } = $props()
  const { logoutConfirm } = getOverlays()

  let open = $state(false)
  let opening = $state<'first' | 'last'>('first')
  let root = $state<HTMLElement>()
  let trigger = $state<HTMLButtonElement>()

  const openSettings = () => {
    hide(false)
    void goto(resolve('/settings'))
  }

  const confirmLogout = () => {
    hide(false)
    logoutConfirm.open({ from: trigger ?? null })
  }

  const items: MenuItem[] = [
    {
      key: 'settings',
      label: '设置',
      leading: { kind: 'icon', icon: Settings },
      run: openSettings,
    },
    {
      key: 'logout',
      label: '退出登录',
      leading: { kind: 'icon', icon: LogOut },
      run: confirmLogout,
    },
  ]

  const show = (focus: 'first' | 'last') => {
    opening = focus
    open = true
  }

  const hide = (returnFocus: boolean) => {
    open = false
    if (returnFocus)
      trigger?.focus()
  }

  const onTriggerKey = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      show(event.key === 'ArrowDown'
        ? 'first'
        : 'last')
    }
  }

  // 点菜单外面就关上
  const onPointerDown = (event: PointerEvent) => {
    if (open && !root?.contains(event.target as Node))
      hide(false)
  }
</script>

<svelte:window onpointerdown={onPointerDown} />

<div bind:this={root} class='relative flex-none'>
  <button
    bind:this={trigger}
    type='button'
    class='press rounded-full transition-transform duration-move-feedback mouse:hover:brightness-95'
    aria-label={account.nickname === null
      ? '账号'
      : `账号：${account.nickname}`}
    aria-haspopup='menu'
    aria-expanded={open}
    aria-controls={open ? 'account-menu' : undefined}
    onclick={() => (open
      ? hide(false)
      : show('first'))}
    onkeydown={onTriggerKey}
  >
    <Avatar url={account.avatarUrl} size={36} class='ring-2 ring-white' />
  </button>

  {#if open}
    <div
      class='absolute right-0 top-[calc(100%+8px)] z-50 w-64 origin-top-right rounded-xl bg-white p-2 shadow-float'
      transition:pop={{ below: true }}
    >
      <div class='flex items-center gap-3 px-2 pb-3 pt-1.5'>
        <Avatar url={account.avatarUrl} size={40} />
        {#if account.nickname !== null}
          <p class='min-w-0 truncate text-label text-neutral-900 font-500'>{account.nickname}</p>
        {/if}
      </div>
      <div class='mb-1 h-px bg-neutral-100' role='separator'></div>
      <MenuList
        id='account-menu'
        label='账号'
        layout='popover'
        items={items}
        focus={opening}
        onEscape={() => hide(true)}
        onTab={() => hide(false)}
      />
    </div>
  {/if}
</div>
