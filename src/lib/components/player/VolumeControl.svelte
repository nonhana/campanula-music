<!--
  音量：静音键（图标跟着音量变）和音量滑杆。桌面底栏和桌面播放页都用它；
  静音前的音量记在模块里，在哪儿取消静音都回到它
-->
<script lang='ts' module>
  /** 静音前的音量：取消静音时回到它 */
  let unmuted = 1
</script>

<script lang='ts'>
  import type { ClassValue } from 'svelte/elements'
  import { Volume1, Volume2, VolumeX } from '@lucide/svelte'
  import { getAppView } from '../shared/app-context.svelte'
  import IconButton from '../ui/IconButton.svelte'
  import VolumeSlider from './VolumeSlider.svelte'

  const { class: sliderClass }: { class?: ClassValue } = $props()
  const view = getAppView()
  const volume = $derived(view.state.player.volume)

  function toggleMute() {
    if (volume > 0) {
      unmuted = volume
      view.app.setVolume(0)
    }
    else {
      view.app.setVolume(unmuted)
    }
  }
</script>

<IconButton icon={volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2} label={volume === 0 ? '取消静音' : '静音'} onclick={toggleMute} />
<VolumeSlider class={sliderClass} />
