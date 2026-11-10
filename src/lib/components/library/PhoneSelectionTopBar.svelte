<script lang="ts">
  import { CheckCheck, ListChecks, SquareMinus, X } from '@lucide/svelte';

  import { getOverlays } from '../overlay/overlay-context';
  import { formatCount } from '../shared/text';
  import TextButton from '../ui/TextButton.svelte';

  const { multiSelect } = getOverlays();
</script>

<div class="min-w-0 flex flex-1 items-center gap-1">
  <button
    type="button"
    class="grid size-11 flex-none place-items-center rounded-full text-neutral-800 active:bg-primary-100"
    aria-label="退出多选"
    onclick={() => multiSelect.leave()}
  >
    <X size={22} aria-hidden="true" />
  </button>
  <span
    class="min-w-0 inline-flex flex-1 items-center gap-1.5 text-body text-neutral-900 font-500 tabular-nums"
    role="status"
  >
    <ListChecks size={16} class="flex-none" aria-hidden="true" />
    <span class="min-w-0 truncate"
      >{multiSelect.size > 0
        ? `已选 ${formatCount(multiSelect.size)} 首`
        : '选择歌曲'}</span
    >
  </span>
  <TextButton
    icon={multiSelect.allOn ? SquareMinus : CheckCheck}
    class="px-3.5!"
    onclick={() => multiSelect.selectAll()}
  >
    {multiSelect.allOn ? '全不选' : '全选'}
  </TextButton>
</div>
