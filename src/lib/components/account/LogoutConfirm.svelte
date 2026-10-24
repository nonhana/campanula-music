<!--
  退出登录的确认（#57）：设置页账号卡和桌面头像菜单都先打开它，由浮层宿主挂载。外壳 DialogShell 的 confirm 尺寸、内容 ConfirmPanel；
  打开时焦点在“取消”上，收起后回到打开它的地方；确认键用实心深薄荷，出错红只给删除歌单。
  确认后先收起（手机退掉弹层压的浅路由），再把这一页的浏览记录换成首页、退出登录。
  退出会清掉这个浏览器里的曲库和播放队列，已下载的歌留着（ADR-0006）。
-->
<script lang='ts'>
  import ConfirmPanel from '../overlay/ConfirmPanel.svelte'
  import DialogShell from '../overlay/DialogShell.svelte'
  import { getOverlays } from '../overlay/overlay-context'
  import { getAppView } from '../shared/app-context.svelte'
  import Button from '../ui/Button.svelte'

  const { logoutConfirm } = getOverlays()

  const view = getAppView()

  const logout = async () => {
    if (await logoutConfirm.leaveTo('/') === 'committed')
      void view.app.logout().catch(error => console.error('退出失败', error))
  }
</script>

<DialogShell layer={logoutConfirm} title={() => '退出登录？'} size={() => 'confirm'}>
  {#snippet children(_request, sheet: boolean)}
    <ConfirmPanel {sheet} oncancel={() => logoutConfirm.close()}>
      {#snippet body()}
        <p class='text-body text-neutral-700'>会清掉这个浏览器里的曲库和播放队列，已下载的歌会留着。</p>
      {/snippet}
      {#snippet confirm()}
        <Button variant='primary' onclick={() => void logout()}>退出登录</Button>
      {/snippet}
    </ConfirmPanel>
  {/snippet}
</DialogShell>
