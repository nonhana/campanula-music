<!--
  打开 App、问服务端当前账号的这一小会儿：还不知道该显示登录页还是曲库，正中只放 logo、不动。第一次打开时接手 app.html 的第一帧
  （同一位置、同样大小，所以铺满窗口、不占排版）；换成别的一屏时这朵花飞到那一屏左上角的 Brand（boot/opening.ts 按 data-opening 找它）。
  不铺底色：晨光底在 html 上，淡出的这会儿也不盖住下面新的一屏。
-->
<script lang='ts'>
  import Logo from '../svg/Logo.svelte'
</script>

<div class='fixed inset-0 grid place-items-center' role='status' data-opening>
  <Logo size={40} />
  <span class='sr-only'>正在打开 Campanula</span>
</div>
