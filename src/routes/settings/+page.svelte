<!-- 设置：先只有账号和退出登录（手机上退出登录在这里，桌面在头像菜单里也有） -->
<script lang='ts'>
  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'
  import { getAppView } from '$lib/components/app-context.svelte'
  import Avatar from '$lib/components/Avatar.svelte'
  import { desktopLayout } from '$lib/components/layout'
  import Button from '$lib/components/ui/Button.svelte'
  import { LogOut } from '@lucide/svelte'

  const view = getAppView()
  const account = $derived(view.state.session.status === 'signedIn' ? view.state.session.account : null)

  function logout() {
    void goto(resolve('/'), { replaceState: true })
    void view.app.logout()
  }
</script>

<div class='max-w-[640px] px-4 pt-2 md:px-0 md:pt-6'>
  {#if desktopLayout.current}
    <h1 class='text-headline text-neutral-900 font-600'>设置</h1>
  {/if}
  <section class='mt-0 md:mt-8' aria-labelledby='settings-account'>
    <h2 id='settings-account' class='px-1 text-title-sm text-neutral-900 font-600'>账号</h2>
    {#if account}
      <div class='mt-3 rounded-xl bg-white p-5 shadow-ambient'>
        <div class='flex items-center gap-4'>
          <Avatar url={account.avatarUrl} size={56} />
          <div class='min-w-0'>
            <p class='truncate text-title-sm text-neutral-900 font-500'>{account.nickname}</p>
            <p class='mt-0.5 text-caption text-neutral-600'>网易云账号</p>
          </div>
        </div>
        <div class='mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-neutral-100 pt-5'>
          <Button variant='outline' icon={LogOut} onclick={logout}>退出登录</Button>
          <p class='min-w-0 flex-1 basis-56 text-caption text-neutral-600'>退出后，这个浏览器里不再保存你的网易云登录和曲库。</p>
        </div>
      </div>
    {/if}
  </section>
</div>
