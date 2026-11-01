import { clamp } from './clamp'
import type { Grip, PointerSample } from './press'
import { rightButtonDown } from './press'

// 鼠标按住拖动横向滚动的手势核心（DESIGN.md 鼠标拖着滚；Spec #11 第二个测试接入点）：不碰页面、不碰 Svelte。
// 只接鼠标主键，触屏、笔照旧由浏览器自己滚；挪过 5px 才算拖，没挪够是点按。拖着时内容跟手，拖到头就夹住、往回拖立刻跟手。
// 松手速度和松手后的滑行照 Flutter 在 macOS 上的滚动（ADR-0012）：速度用 MacOSScrollViewFlingVelocityTracker，
// 没有吸附时按 BouncingScrollPhysics（decelerationRate: fast）的摩擦一路减速，有吸附时照 PageScrollPhysics 用弹簧停到浏览器选的那一格。
// 单位和 Flutter 一样：px、px/s、s（按下、移动的时间戳是 ms）。

export interface DragScrollSpan {
  /** 按下时滚到哪（scrollLeft） */
  position: number
  /** 最远能滚到哪（scrollWidth - clientWidth） */
  max: number
  /** 这一下按住了松手后还在滑的内容：只让它停，跟着的 click 不算点按（Flutter 滑行时内容不接点按，ScrollActivity.shouldIgnorePointer） */
  stopped: boolean
}

/** 松开或作废时 velocity 是松手后接着往右滚的速度（px/s，负的往左），不甩是 0 */
export type DragScrollPose
  = | { dragging: true, position: number }
    | { dragging: false, velocity: number }

export interface DragScrollCore extends Grip {
  readonly pose: DragScrollPose
}

export interface DragScrollCoreOptions {
  /** 按下时量一次；null 是这次按下不接（滚不动、按在自绘滚动条上） */
  begin: (sample: PointerSample) => DragScrollSpan | null
  onPose: (pose: DragScrollPose) => void
}

/** 鼠标按下后挪过这么多（px）才算拖（和拖动排序一样） */
const SLOP = 5
/** 只记最近这么多个位置（Flutter IOSScrollViewFlingVelocityTracker._sampleSize） */
const SAMPLES = 20
/** 最后一次移动到松手隔了这么久（ms）就当手已经停了，不甩（Flutter VelocityTracker._assumePointerMoveStoppedMilliseconds；Android ASSUME_POINTER_STOPPED_TIME） */
const STOPPED_MS = 40
/** 最近三段相邻位置的速度按这个权重相加，从旧到新（Flutter MacOSScrollViewFlingVelocityTracker） */
const WEIGHTS = [0.15, 0.65, 0.2] as const
/** 不快过这个速度（px/s）不算甩（Flutter BouncingScrollPhysics.minFlingVelocity = kMinFlingVelocity × 2） */
const MIN_FLING_VELOCITY = 100
/** 记下的位置头尾挪过不到这么多（px）不算甩（Flutter isFlingGesture 的 minDistance，鼠标是 kPrecisePointerHitSlop） */
const MIN_FLING_DISTANCE = 1
/** 速度最多算到这么快（px/s；BouncingScrollPhysics fast 的 maxFlingVelocity = kMaxFlingVelocity × 8） */
const MAX_FLING_VELOCITY = 64_000

interface Mark {
  x: number
  /** ms */
  time: number
}

interface Press {
  pointerId: number
  /** 按下的地方：挪没挪够起拖距离从这里算 */
  from: Mark & { y: number }
  max: number
  dragging: boolean
  stopped: boolean
  position: number
  /** 上一次移动的横坐标：跟手按每次挪过的距离走，拖到头夹住后往回拖立刻跟上 */
  x: number
  /** 按下和最近几次移动的位置（最多 SAMPLES 个），松手时算速度 */
  marks: Mark[]
}

/**
 * 松手时指针横着的速度（px/s，往右为正）：手已经停了、太慢、几乎没挪都是 0。照 Flutter MacOSScrollViewFlingVelocityTracker.getVelocityEstimate
 * 加上 DragGestureRecognizer.isFlingGesture / considerFling：最后一次移动隔了 40ms 以上算停了；否则最近三段相邻位置的速度按 0.15、0.65、0.2 相加
 */
export const releaseVelocity = (marks: readonly Mark[], releasedAt: number): number => {
  const newest = marks.at(-1)
  const oldest = marks[0]
  if (!newest || !oldest || releasedAt - newest.time > STOPPED_MS)
    return 0
  /** 第 end 个位置和它前一个之间的速度；缺一个、时间没走都是 0 */
  const between = (end: number): number => {
    const start = marks[end - 1]
    const stop = marks[end]
    if (!start || !stop || stop.time <= start.time)
      return 0
    return (stop.x - start.x) * 1000 / (stop.time - start.time)
  }
  const last = marks.length - 1
  const velocity = WEIGHTS.reduce((sum, weight, i) => sum + weight * between(last - (WEIGHTS.length - 1) + i), 0)
  if (Math.abs(velocity) <= MIN_FLING_VELOCITY || Math.abs(newest.x - oldest.x) <= MIN_FLING_DISTANCE)
    return 0
  return clamp(velocity, -MAX_FLING_VELOCITY, MAX_FLING_VELOCITY)
}

export const createDragScrollCore = ({ begin, onPose }: DragScrollCoreOptions): DragScrollCore => {
  let pose: DragScrollPose = { dragging: false, velocity: 0 }
  let press: Press | null = null
  /** 拖过、作废、按停了滑行之后跟着来的那次指针 click 不算点按（下次按下时重算） */
  let swallowClick = false

  const setPose = (next: DragScrollPose) => {
    pose = next
    onPose(next)
  }

  const abandon = (pointerId?: number) => {
    if (!press || (pointerId !== undefined && pointerId !== press.pointerId))
      return
    const { dragging, stopped } = press
    press = null
    swallowClick = true
    // 停在手底下这一刻的位置，不甩：滚动不回到按下时；有吸附时由适配器停到最近的一格
    if (dragging || stopped)
      setPose({ dragging: false, velocity: 0 })
  }

  return {
    get pose() {
      return pose
    },
    get holding() {
      return press !== null
    },
    press(sample) {
      if (sample.pointerType !== 'mouse' || !sample.isPrimary || sample.button !== 0)
        return false
      abandon()
      swallowClick = false
      const span = begin(sample)
      if (!span)
        return false
      const from = { x: sample.x, y: sample.y, time: sample.time }
      press = {
        pointerId: sample.pointerId,
        from,
        max: span.max,
        dragging: false,
        stopped: span.stopped,
        position: span.position,
        x: sample.x,
        marks: [from],
      }
      swallowClick = span.stopped
      return true
    },
    move(sample) {
      if (press?.pointerId !== sample.pointerId)
        return
      if (rightButtonDown(sample.buttons))
        return abandon()
      press.marks.push({ x: sample.x, time: sample.time })
      if (press.marks.length > SAMPLES)
        press.marks.shift()
      if (!press.dragging) {
        if (Math.hypot(sample.x - press.from.x, sample.y - press.from.y) < SLOP)
          return
        press.dragging = true
      }
      press.position = clamp(press.position - (sample.x - press.x), 0, press.max)
      press.x = sample.x
      setPose({ dragging: true, position: press.position })
    },
    release(sample) {
      if (press?.pointerId !== sample.pointerId)
        return
      const ended = press
      press = null
      if (ended.dragging) {
        swallowClick = true
        // 往左拖内容往左走，滚动位置变大：滚动速度和指针速度反号（不甩时给 0，不给 -0）
        const pointerVelocity = releaseVelocity(ended.marks, sample.time)
        setPose({
          dragging: false,
          velocity: pointerVelocity === 0
            ? 0
            : -pointerVelocity,
        })
      }
      // 只是按停了滑行：停在这里，有吸附时由适配器停到最近的一格
      else if (ended.stopped) {
        setPose({ dragging: false, velocity: 0 })
      }
    },
    abandon,
    click(detail) {
      const swallow = swallowClick && detail > 0
      swallowClick = false
      return swallow
    },
  }
}

/** 松手后的滑行：t 秒时滚到哪、停没停；停下时 at 正好是终点 */
export interface Glide {
  at: (t: number) => number
  done: (t: number) => boolean
}

/** 速度慢到、离终点近到这个程度就算停了（Flutter ScrollPhysics.toleranceFor：速度 1/(0.05·dpr) px/s，距离 1/dpr px） */
export interface GlideTolerance {
  velocity: number
  distance: number
}

export const glideTolerance = (devicePixelRatio: number): GlideTolerance => ({
  velocity: 1 / (0.05 * devicePixelRatio),
  distance: 1 / devicePixelRatio,
})

/** 每秒剩下的速度比例（Flutter BouncingScrollSimulation：取自 UIScrollView.decelerationRate .normal = 0.998，0.998^1000 ≈ 0.135） */
const DRAG = 0.135
/** 另外每秒再减这么多速度（px/s²；BouncingScrollPhysics decelerationRate: fast，macOS 的默认） */
const CONSTANT_DECELERATION = 1400
/** 停到某一格用的弹簧（BouncingScrollPhysics fast 的 spring，PageScrollPhysics 停到某一页也用它）：过阻尼，不来回晃 */
const SPRING = { mass: 0.3, stiffness: 75, ratio: 1.3 }

/**
 * 没有吸附：从 position 以 velocity 一路减速，照 Flutter FrictionSimulation（带 constantDeceleration）。
 * 滚到头就停在头上：原生滚动区拉不过头，和 Flutter 夹住边界的滚动一样碰到边就停（BallisticScrollActivity 碰边 goIdle）
 */
export const frictionGlide = (position: number, velocity: number, max: number, tolerance: GlideTolerance): Glide => {
  const dragLog = Math.log(DRAG)
  const deceleration = CONSTANT_DECELERATION * Math.sign(velocity)
  /** t 秒时的速度（FrictionSimulation.dx，不管停没停） */
  const velocityAt = (t: number) => velocity * DRAG ** t - deceleration * t
  // 速度减到 0 的时刻：牛顿法从 0 开始迭代 10 次（FrictionSimulation 构造时求 _finalTime 的做法）
  let finalTime = 0
  for (let i = 0; i < 10; i++)
    finalTime -= velocityAt(finalTime) / (velocity * DRAG ** finalTime * dragLog - deceleration)
  const at = (t: number) => {
    const s = Math.min(t, finalTime)
    return clamp(position + velocity * DRAG ** s / dragLog - velocity / dragLog - deceleration / 2 * s * s, 0, max)
  }
  return {
    at,
    done: t => t >= finalTime
      || Math.abs(velocityAt(t)) < tolerance.velocity
      || (velocity < 0 && at(t) <= 0)
      || (velocity > 0 && at(t) >= max),
  }
}

/** 有吸附：从 position 带着 velocity 停到 target，照 Flutter ScrollSpringSimulation（PageScrollPhysics 停到某一页的做法），停下时正好在 target */
export const springGlide = (position: number, target: number, velocity: number, tolerance: GlideTolerance): Glide => {
  const { mass, stiffness, ratio } = SPRING
  const damping = ratio * 2 * Math.sqrt(mass * stiffness)
  // 过阻尼的解（Flutter _OverdampedSolution）：distance 是起点离终点多远
  const root = Math.sqrt(damping * damping - 4 * mass * stiffness)
  const r1 = (-damping - root) / (2 * mass)
  const r2 = (-damping + root) / (2 * mass)
  const distance = position - target
  const c2 = (velocity - r1 * distance) / (r2 - r1)
  const c1 = distance - c2
  const offset = (t: number) => c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t)
  const speed = (t: number) => c1 * r1 * Math.exp(r1 * t) + c2 * r2 * Math.exp(r2 * t)
  const done = (t: number) => Math.abs(offset(t)) < tolerance.distance && Math.abs(speed(t)) < tolerance.velocity
  return {
    at: t => (done(t)
      ? target
      : target + offset(t)),
    done,
  }
}

/** 没有吸附时松手后会停在哪（滑到头就是头），有吸附时交给浏览器从这里挑最近的一格 */
export const glideEnd = (position: number, velocity: number, max: number): number => {
  if (velocity === 0)
    return position
  const glide = frictionGlide(position, velocity, max, { velocity: 0, distance: 0 })
  return glide.at(Number.POSITIVE_INFINITY)
}
