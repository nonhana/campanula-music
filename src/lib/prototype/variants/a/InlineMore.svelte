<!-- PROTOTYPE：文案里提到“更多”菜单时，画出和按钮上一样的图标，不用 ••• 字符。 -->
<script lang='ts'>
  import { Ellipsis } from '@lucide/svelte'
</script>

<span class='more' role='img' aria-label='更多'><Ellipsis size={14} strokeWidth={2.4} aria-hidden='true' /></span>

<style>
  .more {
    display: inline-grid;
    width: 24px;
    height: 18px;
    margin: 0 3px;
    place-items: center;
    vertical-align: -3px;
    border-radius: 6px;
    background: #eef2f0;
    color: #374151;
  }
</style>
