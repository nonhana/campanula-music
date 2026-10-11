<!--
  打开 App、问服务端当前账号的这一小会儿：还不知道该显示登录页还是曲库，只放 logo。
  logo 晚 400ms 才淡入，通常请求先回来，听众看不到这一闪。
-->
<script lang='ts'>
  import Logo from './svg/Logo.svelte'
</script>

<div class='grid place-items-center bg-primary-50 min-h-dvh' role='status'>
  <span class='appear'><Logo size={40} /></span>
  <span class='sr-only'>正在打开 Campanula</span>
</div>

<style>
  .appear {
    animation: appear 240ms ease-out 400ms both;
  }

  @keyframes appear {
    from {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .appear {
      animation: none;
    }
  }
</style>
