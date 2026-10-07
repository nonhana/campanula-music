// PROTOTYPE：dnd-kit 的传感器配置，必须传给每一个 createSortable（不能只传给 DragDropProvider）。
// 实测 @dnd-kit/dom 0.5.0：Provider 在第一次渲染之后才用 $effect 设置 manager.sensors，那时每一行已经用默认传感器绑定过了；
// 之后虽然传感器实例的 options 更新了，按下时 handlePointerDown 用的还是绑定时的 options（undefined），
// 于是走默认的 preventActivation：“从可拖元素里面的按钮上按下不算拖”——而我们整行可点的地方就是一个按钮，结果怎么也拖不起来。
import { KeyboardSensor, PointerActivationConstraints, PointerSensor } from '@dnd-kit/dom'

export function kitSensors(longPress: number) {
  return [
    PointerSensor.configure({
      activationConstraints(event: PointerEvent) {
        // 把手上按下立即开始拖（把手有 touch-action: none，不会和滚动抢）
        if ((event.target as Element | null)?.closest('[data-grip]'))
          return undefined
        // 触屏：长按；手指挪动超过 8px 算在滚动，放弃
        if (event.pointerType !== 'mouse')
          return [new PointerActivationConstraints.Delay({ value: longPress, tolerance: 8 })]
        // 鼠标：挪动 5px 开始拖，单击仍然是播放
        return [new PointerActivationConstraints.Distance({ value: 5 })]
      },
      // 只挡“更多”按钮；整行的点击区虽然是按钮，也要能拖
      preventActivation(event: PointerEvent) {
        return Boolean((event.target as Element | null)?.closest('[data-more]'))
      },
    }),
    KeyboardSensor,
  ]
}
