// 让网易云替身回得慢：world.netease.reply(fixture, { until }) 的 until

/** 网易云压着不回：等它的请求一直在路上（例如让后台同步停在这一步） */
export function never(): Promise<void> {
  return new Promise<void>(() => {})
}

/** 一个压着不回的网易云返回：release() 了才回 */
export function held(): { until: Promise<void>, release: () => void } {
  let release = (): void => {}
  const until = new Promise<void>((resolve) => {
    release = resolve
  })
  return { until, release }
}
