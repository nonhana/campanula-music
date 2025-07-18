import type { ApiResponse, CookieObject, SongUrlQuery } from '../types/index.js'
import { API_CONFIG, OS_MAP, USER_AGENT_MAP } from '../config/index.js'
import {
  cookieToJson,
  eapiEncrypt,
  generateNMTID,
  generateNuid,
  generateWNMCID,
} from '../utils/index.js'

export async function createNeteaseRequest(
  uri: string,
  data: Record<string, any>,
  query: SongUrlQuery,
): Promise<ApiResponse> {
  const options = {
    crypto: query.crypto || 'eapi',
    cookie: query.cookie || {},
    ua: query.ua || '',
    realIP: query.realIP,
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  }

  if (options.realIP) {
    headers['X-Real-IP'] = options.realIP
    headers['X-Forwarded-For'] = options.realIP
  }

  let cookie: CookieObject = {}
  if (typeof options.cookie === 'string') {
    cookie = cookieToJson(options.cookie)
  }
  else if (typeof options.cookie === 'object') {
    cookie = { ...options.cookie }
  }

  if (typeof cookie === 'object') {
    const _ntes_nuid = generateNuid()
    const os = OS_MAP[cookie.os as keyof typeof OS_MAP] || OS_MAP.iphone

    cookie = {
      ...cookie,
      __remember_me: 'true',
      ntes_kaola_ad: '1',
      _ntes_nuid: cookie._ntes_nuid || _ntes_nuid,
      _ntes_nnid: cookie._ntes_nnid || `${_ntes_nuid},${Date.now().toString()}`,
      WNMCID: cookie.WNMCID || generateWNMCID(),
      WEVNSM: cookie.WEVNSM || '1.0.0',
      osver: cookie.osver || os.osver,
      deviceId: cookie.deviceId || 'defaultDeviceId',
      os: cookie.os || os.os,
      channel: cookie.channel || os.channel,
      appver: cookie.appver || os.appver,
    }

    if (!uri.includes('login')) {
      cookie.NMTID = generateNMTID()
    }

    if (!cookie.MUSIC_U) {
      cookie.MUSIC_A = cookie.MUSIC_A || ''
    }
  }

  let url = ''
  let encryptData: any = {}
  const crypto = options.crypto
  const csrfToken = cookie.__csrf || ''

  if (crypto === 'eapi' || crypto === 'api') {
    const headerObj: Record<string, string | undefined> = {
      osver: cookie.osver,
      deviceId: cookie.deviceId,
      os: cookie.os,
      appver: cookie.appver,
      versioncode: cookie.versioncode || '140',
      mobilename: cookie.mobilename || '',
      buildver: cookie.buildver || Date.now().toString().slice(0, 10),
      resolution: cookie.resolution || '1920x1080',
      __csrf: csrfToken,
      channel: cookie.channel,
      requestId: `${Date.now()}_${Math.floor(Math.random() * 1000)
        .toString()
        .padStart(4, '0')}`,
    }

    if (cookie.MUSIC_U)
      headerObj.MUSIC_U = cookie.MUSIC_U
    if (cookie.MUSIC_A)
      headerObj.MUSIC_A = cookie.MUSIC_A

    headers.Cookie = Object.keys(headerObj)
      .filter(key => headerObj[key] !== undefined)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(headerObj[key]!)}`)
      .join('; ')

    headers['User-Agent'] = options.ua || USER_AGENT_MAP.api.iphone

    if (crypto === 'eapi') {
      data.header = headerObj
      data.e_r = false
      encryptData = eapiEncrypt(uri, data)
      url = `${API_CONFIG.apiDomain}/eapi${uri.slice(4)}`
    }
    else {
      url = `${API_CONFIG.apiDomain}${uri}`
      encryptData = data
    }
  }

  try {
    const body
      = crypto === 'api' ? JSON.stringify(encryptData) : new URLSearchParams(encryptData).toString()

    if (crypto === 'api') {
      headers['Content-Type'] = 'application/json'
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
    })

    const responseText = await response.text()
    let responseBody: any

    try {
      responseBody = JSON.parse(responseText)
    }
    catch {
      responseBody = responseText
    }

    const code = responseBody.code || response.status
    let status = Number(code)

    if ([201, 302, 400, 502, 800, 801, 802, 803].includes(status)) {
      status = 200
    }

    status = status > 100 && status < 600 ? status : 400

    const setCookies = response.headers.get('set-cookie')?.split(',') || []
    const responseCookies = setCookies.map(cookie => cookie.replace(/\s*Domain=[^(;|$)]+;*/g, ''))

    const result: ApiResponse = {
      status,
      body: responseBody,
      cookie: responseCookies,
    }

    if (status === 200) {
      return result
    }
    throw result
  }
  catch (error) {
    if (error && typeof error === 'object' && 'status' in error) {
      throw error
    }

    const apiError = new Error(error instanceof Error ? error.message : 'Request failed')
    Object.assign(apiError, {
      status: 502,
      body: {
        code: 502,
        msg: error instanceof Error ? error.message : 'Request failed',
      },
      cookie: [],
    })
    throw apiError
  }
}
