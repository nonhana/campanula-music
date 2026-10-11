<script lang='ts'>
  import Welcome from '$lib/components/welcome/Welcome.svelte'
</script>

<!-- 根布局只在问清当前账号后才渲染页面；登录（#19）之前只会是未登录 -->
<Welcome />
