<!--
  退出登录的确认（#57）：设置页账号卡上的退出键、桌面头像菜单里的“退出登录”都先打开它，由浮层宿主挂载。
  外观和删除歌单的确认一样（外壳 DialogShell 的 confirm 尺寸，内容 ConfirmPanel）：桌面居中弹窗 440px，手机贴着底边的弹层、按钮竖着排；
  点遮罩、Esc、返回都收起，打开时焦点在“取消”上，收起后回到打开它的地方。确认键是实心深薄荷，不用出错红（出错红只给删除歌单）。
  确认后先收起（手机退掉弹层压的浅路由），再把这一页的浏览记录换成首页、退出登录。退出会清掉这个浏览器里的曲库和播放队列，
  已下载的歌留着（ADR-0006）。
-->
<script lang='ts'>
  import { getAppView } from './app-context.svelte'
  import ConfirmPanel from './ConfirmPanel.svelte'
  import DialogShell from './DialogShell.svelte'
  import { getOverlays } from './overlay-context'
  import Button from './ui/Button.svelte'

  const { logoutConfirm } = getOverlays()

  const view = getAppView()

  async function logout() {
    if (await logoutConfirm.leaveTo('/') === 'committed')
      void view.app.logout()
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
