export interface ApiResponse<T = any> {
  status: number
  body: T
  cookie: string[]
}

export interface SongUrlResponse {
  code: number
  data: Array<{
    id: number
    url: string
    br: number
    size: number
    md5: string
    code: number
    expi: number
    type: string
    gain: number
    peak: number
    fee: number
    uf?: any
    payed: number
    flag: number
    canExtend: boolean
    freeTrialInfo?: any
    level: string
    encodeType: string
    freeTrialPrivilege?: {
      resConsumable: boolean
      userConsumable: boolean
      listenType?: any
      cannotListenReason?: any
      playReason?: any
    }
    freeTimeTrialPrivilege?: {
      resConsumable: boolean
      userConsumable: boolean
      type: number
      remainTime: number
    }
    urlSource: number
    rightSource: number
    podcastCtrp?: any
    effectTypes?: any
    time: number
  }>
}
