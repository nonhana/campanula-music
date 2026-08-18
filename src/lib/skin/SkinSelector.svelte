<script lang='ts'>
  import { Check } from 'lucide-svelte'
  import { currentSkin, setSkin } from './currentSkin'
  import { SKINS } from './skins'

  const activeSkin = $derived($currentSkin)
</script>

<div role='radiogroup' aria-label='皮肤' class='grid gap-3 sm:grid-cols-2'>
  {#each SKINS as skin (skin.id)}
    <button
      type='button'
      role='radio'
      aria-checked={activeSkin === skin.id}
      class={[
        'flex items-center gap-4 rounded-xl border p-4 text-left transition-colors',
        activeSkin === skin.id
          ? 'border-primary-400 bg-primary/5'
          : 'border-app-border bg-app-surface hover:bg-app-surface-hover',
      ]}
      onclick={() => setSkin(skin.id)}
    >
      <span
        class='size-10 shrink-0 border border-app-border rounded-lg'
        style='background: rgb(var(--skin-primary))'
        aria-hidden='true'
      ></span>
      <span class='min-w-0 flex-1'>
        <span class='block text-sm text-app-text font-medium'>{skin.label}</span>
        {#if skin.description}
          <span class='mt-0.5 block text-xs text-app-text-muted'>{skin.description}</span>
        {/if}
      </span>
      {#if activeSkin === skin.id}
        <Check class='size-5 shrink-0 text-primary-700' />
      {/if}
    </button>
  {/each}
</div>
