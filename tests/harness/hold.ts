// 让网易云替身回得慢：world.netease.reply(fixture, { until }) 的 until

/** 永远不了结；大家共用一个，网易云替身才认得出两个“一直压着”的回答是一样的 */
const NEVER = new Promise<void>(() => {})

/** 网易云压着不回：等它的请求一直在路上（例如让后台同步停在这一步） */
export const never = (): Promise<void> => NEVER

/** 一个压着不回的网易云返回：release() 了才回 */
export const held = (): { until: Promise<void>, release: () => void } => {
  let release = (): void => {}
  const until = new Promise<void>((resolve) => {
    release = resolve
  })
  return { until, release }
}
