/** 提示条放在哪：桌面底部正中，手机迷你播放条上方，手机播放页开着时顶上 */
export type NoticePlace = 'desktop' | 'bottom' | 'top'

/**
 * 提示条换位置的门闩：记住上一次在哪；换了位置只淡入，刚出现才从边上飘进来（DESIGN.md Overlays，motion.ts 的 toast）。
 * 播放提示和改曲库、下载的提示共用。
 */
export const noticeArrival = (place: () => NoticePlace | null): { moved: boolean } => {
  let last: NoticePlace | null = null
  const arrival = { moved: false }
  $effect.pre(() => {
    const now = place()
    arrival.moved = last !== null && now !== null && now !== last
    last = now
  })
  return arrival
}
