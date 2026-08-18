<script lang='ts'>
  import { Check } from 'lucide-svelte'
  import { currentSoundLevel, setSoundLevel } from './currentSoundLevel'
  import { SOUND_LEVELS } from './levels'

  const activeLevel = $derived($currentSoundLevel)
</script>

<div role='radiogroup' aria-label='音质档位' class='grid gap-3 sm:grid-cols-2'>
  {#each SOUND_LEVELS as level (level.id)}
    <button
      type='button'
      role='radio'
      aria-checked={activeLevel === level.id}
      class={[
        'flex items-center gap-4 rounded-xl border p-4 text-left transition-colors',
        activeLevel === level.id
          ? 'border-primary-400 bg-primary/5'
          : 'border-app-border bg-app-surface hover:bg-app-surface-hover',
      ]}
      onclick={() => setSoundLevel(level.id)}
    >
      <span class='min-w-0 flex-1'>
        <span class='block text-sm text-app-text font-medium'>{level.label}</span>
        {#if level.description}
          <span class='mt-0.5 block text-xs text-app-text-muted'>{level.description}</span>
        {/if}
      </span>
      {#if activeLevel === level.id}
        <Check class='size-5 shrink-0 text-primary-700' />
      {/if}
    </button>
  {/each}
</div>
