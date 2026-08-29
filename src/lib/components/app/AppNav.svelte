<script lang='ts'>
  import { resolve } from '$app/paths'
  import { page } from '$app/state'
  import Logo from '$lib/components/svg/Logo.svelte'
  import { navItems } from '$lib/config'

  function isActive(href: string) {
    const pathname = page.url.pathname
    return href === '/' ? pathname === '/' : pathname.startsWith(href)
  }
</script>

<!-- 桌面端侧边导航 -->
<nav
  class='fixed inset-y-0 left-0 z-20 w-60 flex-col border-r border-app-border bg-app-surface hidden md:flex'
  aria-label='主导航'
>
  <a href={resolve('/')} class='h-16 flex shrink-0 items-center gap-3 px-5'>
    <Logo />
    <span class='text-lg text-app-text font-semibold'>Campanula</span>
  </a>
  <ul class='flex flex-1 flex-col gap-1 p-3'>
    {#each navItems as { title, href, icon: Icon } (href)}
      <li>
        <a
          href={resolve(href)}
          aria-current={isActive(href) ? 'page' : undefined}
          class={[
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
            isActive(href)
              ? 'bg-primary/10 font-medium text-primary-700'
              : 'text-app-text-muted hover:bg-app-surface-hover hover:text-app-text',
          ]}
        >
          <Icon class='size-5' />
          {title}
        </a>
      </li>
    {/each}
  </ul>
</nav>

<!-- 移动端顶栏 -->
<header class='sticky top-0 z-20 h-14 flex items-center gap-3 border-b border-app-border bg-app-surface px-4 md:hidden'>
  <Logo />
  <span class='text-base text-app-text font-semibold'>Campanula</span>
</header>

<!-- 移动端底部导航 -->
<nav
  class='fixed inset-x-0 bottom-0 z-20 border-t border-app-border bg-app-surface md:hidden'
  aria-label='主导航'
>
  <ul class='grid grid-cols-3 h-16'>
    {#each navItems as { title, href, icon: Icon } (href)}
      <li>
        <a
          href={resolve(href)}
          aria-current={isActive(href) ? 'page' : undefined}
          class={[
            'flex h-full flex-col items-center justify-center gap-1 text-xs transition-colors',
            isActive(href) ? 'text-primary-700' : 'text-app-text-muted',
          ]}
        >
          <Icon class='size-5' />
          {title}
        </a>
      </li>
    {/each}
  </ul>
</nav>
