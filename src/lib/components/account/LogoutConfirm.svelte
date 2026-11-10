<script lang="ts">
  import { resolve } from '$app/paths';

  import ConfirmPanel from '../overlay/ConfirmPanel.svelte';
  import DialogShell from '../overlay/DialogShell.svelte';
  import { getOverlays } from '../overlay/overlay-context';
  import { getAppView } from '../shared/app-context.svelte';
  import Button from '../ui/Button.svelte';

  const { logoutConfirm } = getOverlays();

  const view = getAppView();

  const logout = async () => {
    if ((await logoutConfirm.leaveTo(resolve('/'))) === 'committed')
      void view.app.logout().catch((error) => console.error('退出失败', error));
  };
</script>

<DialogShell
  layer={logoutConfirm}
  title={() => '退出登录？'}
  size={() => 'confirm'}
>
  {#snippet children(_request, sheet: boolean)}
    <ConfirmPanel {sheet} oncancel={() => logoutConfirm.close()}>
      {#snippet body()}
        <p class="text-body text-neutral-700">
          清除本机曲库副本和播放队列，保留已下载歌曲
        </p>
      {/snippet}
      {#snippet confirm()}
        <Button variant="primary" onclick={() => void logout()}>退出登录</Button
        >
      {/snippet}
    </ConfirmPanel>
  {/snippet}
</DialogShell>
