<script lang='ts'>
  import { resolve } from '$app/paths'
  import { bindingInvalid } from '$lib/binding'
  import { TriangleAlert } from 'lucide-svelte'
</script>

{#if $bindingInvalid}
  <!-- 绑定失效常驻预警：置位期间全程可见，引导回全屏绑定页；恢复有效后自动消失 -->
  <div
    role='alert'
    class='fixed inset-x-0 top-0 z-30 flex items-center justify-center gap-2 bg-error-700 px-4 py-2 text-sm text-white'
  >
    <TriangleAlert class='size-4 shrink-0' />
    <span>绑定已失效，功能不可用。</span>
    <a href={resolve('/bind')} class='font-medium underline underline-offset-2'>重新扫码绑定</a>
  </div>
{/if}
