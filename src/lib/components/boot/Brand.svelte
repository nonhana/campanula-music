<!-- logo 加上 Campanula 字样：登录页、出错页和两种骨架的左上角。打开 App 时正中的花飞到这里（boot/opening.ts 按 data-brand 找花和字样） -->
<script lang='ts'>
  import Logo from '../svg/Logo.svelte'
</script>

<span class='flex items-center gap-2' data-brand>
  <Logo size={28} />
  <span class='text-title-sm text-neutral-900 font-500' data-brand-name>Campanula</span>
</span>
