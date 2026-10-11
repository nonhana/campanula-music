<!-- Campanula 的 logo：Lucide 的 flower 图形，叶绿描边。图形和颜色不改，也不旋转（PRODUCT.md、DESIGN.md） -->
<script lang='ts'>
  interface Props {
    size?: number
  }

  const { size = 32 }: Props = $props()
</script>

<svg xmlns='http://www.w3.org/2000/svg' width={size} height={size} viewBox='0 0 24 24' fill='none' stroke='#37be8c' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true' class='flex-none'>
  <circle cx='12' cy='12' r='3'></circle>
  <path d='M12 16.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 1 1 4.5 4.5 4.5 4.5 0 1 1-4.5 4.5'></path>
  <path d='M12 7.5V9'></path>
  <path d='M7.5 12H9'></path>
  <path d='M16.5 12H15'></path>
  <path d='M12 16.5V15'></path>
  <path d='m8 8 1.88 1.88'></path>
  <path d='M14.12 9.88 16 8'></path>
  <path d='m8 16 1.88-1.88'></path>
  <path d='M14.12 14.12 16 16'></path>
</svg>
