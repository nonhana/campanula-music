# 一次 eval 拍完一批验收截图（Python eval 里 `%load .agents/skills/campanula-ui-acceptance/scripts/sweep.py`）。
# shoot：静态画面。每张：换视口 → 写拦截规则、按需清空本机副本 → 打开页面 → 等到页面画出来 → 跑检查 → 截图存文件。
# motion：动效逐帧。触发一个变化，把动画停在第 0 / 60 / 120… 毫秒各拍一张；不写 grab 时拍换页（View Transitions）。
# slow：慢放一串操作（连按几次、拖到一半），按墙上的时间截图，看打断和连续触发。
# sheet：把一组截图拼成一张，read 一次看完。
# 只把每张的检查结果打回上下文，图片留在文件里，要看哪张再单独 read。
# 这些函数一次要调很多次 DevTools，eval 的单元格默认 30 秒就超时，超时会把这里定义的东西清掉：调的时候给单元格 timeout=300
import asyncio
import json
import pathlib
import re
import subprocess
import tempfile
import time

ROOT = pathlib.Path(subprocess.run(['git', 'rev-parse', '--show-toplevel'], capture_output=True, text=True, check=True).stdout.strip())
BASE = 'http://localhost:5173'
# 作者那个 Chrome 标签页在 list_pages 里的编号：第一次调 DevTools 前自动找打开着 BASE 的那个（_page()）；
# 编号会随浏览器重连变，找不到时报错。要指定就在 eval 里直接给 PAGE 赋值
PAGE = None
VIEWPORTS = {
    'phone': ('390x844x2,mobile,touch', '390x844'),
    'desktop': ('1440x900x1', '1440x900'),
    '768': ('768x1024x1', '768x1024'),
    '1024': ('1024x768x1', '1024x768'),
}
# 拦截脚本的内容直接作为 initScript，在页面脚本之前装上（这个目录不在 Vite 开发服务器的允许名单里，不能从 /@fs/ 读）
INIT_SCRIPT = (ROOT / '.agents/skills/campanula-ui-acceptance/scripts/intercept.js').read_text()

# 横向溢出：页面比视口宽，或者 main 里有元素伸出视口（768、1024 抽查用）
OVERFLOW_JS = """() => { const w = document.documentElement.clientWidth;
  const out = [...document.querySelectorAll('main *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > w + 1 || r.left < -1) && getComputedStyle(e).position !== 'fixed' });
  return { pageWider: document.documentElement.scrollWidth > w, sticking: out.slice(0, 3).map(e => e.tagName.toLowerCase() + '.' + String(e.className?.baseVal ?? e.className).slice(0, 40)) } }"""

# 减少动态效果：DevTools 工具的 emulate 没有这个开关，打开页面前装上这段：matchMedia 报“减少”，
# 样式表里真正那条 @media (prefers-reduced-motion: reduce) 换成 all。读到的是真的 CSS 变量，但仍是模拟，
# 作者要在 DevTools 的 Rendering 面板里真开一次
REDUCED_SCRIPT = r"""(() => { const q = /prefers-reduced-motion:\s*reduce/; const real = window.matchMedia.bind(window);
  window.matchMedia = s => q.test(s) ? real('all') : real(s);
  const flip = () => { for (const sheet of document.styleSheets) { let rules; try { rules = sheet.cssRules } catch { continue }
    for (const r of rules) if (r instanceof CSSMediaRule && q.test(r.media.mediaText)) r.media.mediaText = 'all' } };
  document.addEventListener('DOMContentLoaded', flip); setInterval(flip, 300) })();"""
REDUCED_CHECK = "() => getComputedStyle(document.documentElement).getPropertyValue('--move-panel').trim()"

# 页面摆好的样子（motion / slow 的 setup、shoot 的 act）。放歌点的是 main 里第一首能放的（歌曲行里的 .play-target）
_PLAY = """const t0 = performance.now(); let row;
  while (!(row = document.querySelector('main .play-target:not(:disabled)')) && performance.now() - t0 < 10000) await new Promise(r => setTimeout(r, 200));
  if (!row) throw new Error('main 里没有能点的歌'); row.click();
  while (!document.querySelector('[style*="player-bar"] [aria-label^="打开播放页"]') && performance.now() - t0 < 12000) await new Promise(r => setTimeout(r, 100));
  await new Promise(r => setTimeout(r, 600));"""
_OPEN = """document.querySelector('[style*="player-bar"] [aria-label^="打开播放页"]').click();
  await new Promise(r => setTimeout(r, 900));
  if (!document.querySelector('[role=dialog][aria-label=正在播放]:not([inert])')) throw new Error('播放页没打开');"""
SETUPS = {
    # 放 main 里第一首能放的歌，等播放条出现（桌面、手机都行）
    'play': f'async () => {{ {_PLAY} return true }}',
    # 放歌，再点播放条打开播放页
    'play-open': f'async () => {{ {_PLAY} {_OPEN} return true }}',
}
# 常用的触发：播放条上的（桌面底栏、手机迷你条），播放页里的
TRIGGERS = {
    'bar-next': "() => document.querySelector('[style*=\"player-bar\"] button[aria-label=下一首]').click()",
    'bar-previous': "() => document.querySelector('[style*=\"player-bar\"] button[aria-label=上一首]').click()",
    'page-next': "() => document.querySelector('[role=dialog] button[aria-label=下一首]').click()",
    'page-previous': "() => document.querySelector('[role=dialog] button[aria-label=上一首]').click()",
    # 在列表里点另一首（第二首能放的）
    'pick-other': "() => document.querySelectorAll('main .play-target:not(:disabled)')[1].click()",
}
# 常用的冻结范围：播放页、播放条里的换碟（封面、歌名、封面染底）
GRABS = {
    'page': '[role=dialog] .disc, [role=dialog] .slot, [role=dialog] .tint img',
    'bar': '[style*="player-bar"] .disc, [style*="player-bar"] .slot',
}

# 模拟页面藏到后台再回来（锁屏、切走）：在这个 Chrome 连接下开新标签页不会让原来的页面变成 hidden，只能在页面里改 visibilityState
HIDE_JS = "() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); return true }"
SHOW_JS = "() => { delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); return document.visibilityState }"

# 冻结动画：抓到的动画（Svelte 过渡、CSS 过渡、Web Animations 和一次性的 CSS 动画；不含转圈、骨架这类循环）停在第 t 毫秒。
# load 设成选择器时，页面一加载就把这些元素新开始的 CSS 过渡冻住（封面淡入）。
# 触发后抓到的（waitAndGrab）拍到某一帧时已经走完的，就让它真的走完：带 delay 的 Svelte 过渡先放一段空动画等 delay，
# 它走完才开始真正的那段；真正那段在同一个元素上新开始，冻在“从空动画走完那一刻算起”的位置。走完的出场过渡会把元素拿掉，和真的一样
FREEZE_SCRIPT = """(() => { if (window.__campanulaFreeze) return;
  const next = () => new Promise(r => requestAnimationFrame(r));
  const loop = a => a.effect?.getComputedTiming().iterations === Infinity;
  const F = window.__campanulaFreeze = { frozen: [], start: new Map(), born: new WeakMap(), armed: false, at: 0, load: null,
    hold(a, start = 0) { if (loop(a) || F.frozen.includes(a)) return; a.pause(); F.start.set(a, start); a.currentTime = Math.max(0, F.at - start); F.frozen.push(a) },
    grab(selector) { for (const el of document.querySelectorAll(selector)) for (const a of el.getAnimations()) F.hold(a); return F.frozen.length },
    async frame(t) { F.at = t;
      for (let round = 0; round < 6; round++) { let ended = false;
        for (const a of [...F.frozen]) { const start = F.start.get(a) ?? 0, end = start + a.effect.getComputedTiming().endTime;
          if (F.armed && t >= end && end > start) { F.frozen.splice(F.frozen.indexOf(a), 1); if (a.effect.target) F.born.set(a.effect.target, end); a.finish(); ended = true }
          else a.currentTime = Math.max(0, t - start) }
        if (!ended) break;
        await next(); await next() }
      return F.frozen.length },
    describe() { return F.frozen.map(a => a.effect.getTiming().duration + 'ms ' + [...new Set(a.effect.getKeyframes().flatMap(k => Object.keys(k)).filter(x => !['offset', 'computedOffset', 'easing', 'composite'].includes(x)))].join(',')) },
    release() { F.load = null; F.armed = false; for (const a of F.frozen) { try { a.finish() } catch {} } F.frozen = []; F.start.clear(); F.born = new WeakMap(); F.at = 0; return true },
    async waitAndGrab(grab, when, timeout) { const t0 = performance.now();
      const live = () => [...document.querySelectorAll(when)].some(el => el.getAnimations().some(a => !loop(a) && a.playState === 'running'));
      while (!live()) { if (performance.now() - t0 > timeout) return null; await next() }
      for (let i = 0; i < 3; i++) { F.grab(grab); await next() }
      await F.frame(0); F.armed = true; return { afterMs: Math.round(performance.now() - t0), anims: F.describe() } },
    async waitLoaded(count, timeout) { const t0 = performance.now();
      while (F.frozen.length < count && performance.now() - t0 < timeout) await new Promise(r => setTimeout(r, 100));
      if (F.frozen.length < count) return null;
      await new Promise(r => setTimeout(r, 400)); await F.frame(0); return { frozen: F.frozen.length, anims: [...new Set(F.describe())] } },
    async waitTurn(timeout) { const t0 = performance.now();
      const turning = () => document.getAnimations().filter(a => a.effect?.pseudoElement?.startsWith('::view-transition'));
      while (turning().length === 0) { if (performance.now() - t0 > timeout) return null; await next() }
      for (const a of turning()) F.hold(a); await F.frame(0);
      return { afterMs: Math.round(performance.now() - t0), types: [...(document.activeViewTransition?.types ?? [])],
        anims: F.frozen.map(a => { const t = a.effect.getComputedTiming(); return `${a.effect.pseudoElement} ${a.animationName} ${t.duration}ms +${t.delay}ms` }) } } };
  const animate = Element.prototype.animate;
  Element.prototype.animate = function (keyframes, options) { const a = animate.call(this, keyframes, options);
    const born = F.armed ? F.born.get(this) : undefined;
    if (born !== undefined) { F.born.delete(this); F.hold(a, born) }
    return a };
  document.addEventListener('transitionrun', e => { if (F.load && e.target.matches?.(F.load)) for (const a of e.target.getAnimations()) F.hold(a) }, true) })();"""

# 拍“图片加载完淡入”时让每张网络图片都重新下载：地址后面加一个随机参数。不加的话，
# 刚看过的图在浏览器内存缓存里，挂上时已经加载好，App 照规矩直接显示、不淡入（ignoreCache 的重新加载管不到后来才插进来的图）
FRESH_IMAGES_SCRIPT = """(() => { const tag = '_fresh=' + Date.now();
  const fresh = v => typeof v === 'string' && /^https?:/.test(v) && !v.includes('_fresh=') ? v + (v.includes('?') ? '&' : '?') + tag : v;
  const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  Object.defineProperty(HTMLImageElement.prototype, 'src', { ...src, set(v) { src.set.call(this, fresh(v)) } });
  const setAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (n, v) { return setAttribute.call(this, n, this instanceof HTMLImageElement && n === 'src' ? fresh(v) : v) } })();"""


async def _page():
    """作者那个标签页的编号：PAGE 没给就从 list_pages 里找打开着 BASE 的那个"""
    global PAGE
    if PAGE is None:
        result = await tool.write(path='xd://mcp__chrome_devtools_list_pages', content='{}', i='DevTools list_pages')
        text = result['text'] if isinstance(result, dict) else str(result)
        found = [int(m.group(1)) for m in re.finditer(r'^(\d+): .*\(' + re.escape(BASE), text, re.M)]
        if not found:
            raise RuntimeError(f'没有打开着 {BASE} 的标签页，先在作者的 Chrome 里打开它：\n{text[-400:]}')
        PAGE = found[0]
    return PAGE


async def devtools(name, **args):
    """调一个 Chrome DevTools 工具，返回它的文字结果"""
    result = await tool.write(path=f'xd://mcp__chrome_devtools_{name}', content=json.dumps({'pageId': await _page(), **args}), i=f'DevTools {name}')
    return result['text'] if isinstance(result, dict) else str(result)


async def run(js, stable=True):
    """在页面里跑一段 () => ... 的函数，返回它的 JSON 结果（返回 undefined 时是 None）。stable=False：不等页面停下来（动画进行中时用）"""
    text = await devtools('evaluate_script', function=js, **({} if stable else {'waitForStableDom': False}))
    start = text.find('```json\n')
    if start < 0:
        raise RuntimeError(f'页面脚本没有返回结果：{text[:300]}')
    body = text[start + 8:text.index('```', start + 8)].strip()
    return None if body in ('', 'undefined') else json.loads(body)


def _wait_js(ready, text, timeout_ms):
    return f"""async () => {{ const t0 = performance.now();
  const ok = () => document.querySelector({json.dumps(ready)}) && (document.querySelector('main')?.innerText ?? '').includes({json.dumps(text)});
  while (!ok() && performance.now() - t0 < {timeout_ms}) await new Promise(r => setTimeout(r, 100));
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  return {{ ready: !!ok(), ms: Math.round(performance.now() - t0) }} }}"""


async def shoot(issue, shots, check_overflow=('768', '1024')):
    """
    shots：一组 dict，每张一个：
      name      文件名前缀，存成 _notes/screenshots/issue-<issue>/<name>-<宽x高>.png
      path      地址，例如 '/playlists/123'
      viewport  'phone' | 'desktop' | '768' | '1024'
      ready     等这个 CSS 选择器出现再截（默认 'main'），例如加载中的骨架 '[aria-busy=true]'、出错的 'main [role=alert]'
      text      再等 main 里出现这段文字，例如空状态的标题“这张歌单还没有歌”
      intercept intercept.js 的规则列表（不写就不拦）
      fresh     True：先清空本机副本（IndexedDB），让歌单回到“还没同步”
      act       截图前在页面里跑的 () => ... 函数（或 SETUPS 里的名字，例如 'play-open'），它的返回值放进结果
      reduced   True：模拟“减少动态效果”打开（REDUCED_SCRIPT）
    返回每张的结果：文件、等了多久、act 的返回值、视口抽查时的溢出情况
    """
    out_dir = ROOT / '_notes/screenshots' / f'issue-{issue}'
    out_dir.mkdir(parents=True, exist_ok=True)
    report, current = [], None
    if not (await run('() => location.origin')).startswith(BASE):
        await devtools('navigate_page', type='url', url=BASE + '/')
    for shot in shots:
        size_arg, size_name = VIEWPORTS[shot['viewport']]
        if size_arg != current:
            await devtools('emulate', viewport=size_arg)
            current = size_arg
        rules = json.dumps({'rules': shot['intercept']}) if shot.get('intercept') else None
        # 删本机数据库时页面可能还开着它（同步在跑）：先报 blocked，App 让开后才删掉。
        # 一定要等到删完再换页面，换页面会把还没删完的请求一起丢掉
        cleared = await run(f"""() => new Promise(resolve => {{
          {f"localStorage.setItem('campanula-intercept', {json.dumps(rules)})" if rules else "localStorage.removeItem('campanula-intercept')"};
          if (!{json.dumps(bool(shot.get('fresh')))}) return resolve('kept');
          const r = indexedDB.deleteDatabase('campanula'); r.onsuccess = () => resolve('cleared'); r.onerror = () => resolve('error');
          setTimeout(() => resolve('timeout'), 5000) }})""")
        if cleared not in ('kept', 'cleared'):
            raise RuntimeError(f"{shot['name']}：本机数据库没清掉（{cleared}），换个时机再拍")
        await devtools('navigate_page', type='url', url=BASE + shot['path'], initScript=INIT_SCRIPT + (';\n' + REDUCED_SCRIPT if shot.get('reduced') else ''))
        waited = await run(_wait_js(shot.get('ready', 'main'), shot.get('text', ''), 15000))
        if not waited['ready']:
            raise RuntimeError(f"{shot['name']}：等了 15 秒，页面没出现 {shot.get('ready', 'main')} {shot.get('text', '')}，截出来的不是要的画面")
        if shot.get('reduced') and await run(REDUCED_CHECK) != '0ms':
            raise RuntimeError(f"{shot['name']}：减少动态效果没模拟上，截出来的不是要的状态")
        if rules and not await run('() => window.__campanulaIntercept === true'):
            raise RuntimeError(f"{shot['name']}：拦截没装上，截出来的不是要的状态")
        entry = {'name': shot['name'], 'size': size_name, **waited}
        if shot.get('act'):
            entry['act'] = await run(_named(shot['act'], SETUPS))
        if shot['viewport'] in check_overflow:
            entry['overflow'] = await run(OVERFLOW_JS)
        file = out_dir / f"{shot['name']}-{size_name}.png"
        await devtools('take_screenshot', filePath=str(file))
        entry['file'] = str(file.relative_to(ROOT))
        report.append(entry)
    # 拦截规则只给这一批用：清掉规则、换回桌面视口、重新打开首页（不带拦截），
    # 被 fresh 清空的本机副本照常重新同步，作者的浏览器回到正常
    await run("() => { localStorage.removeItem('campanula-intercept'); return 'ok' }")
    await devtools('emulate', viewport=VIEWPORTS['desktop'][0])
    await devtools('navigate_page', type='url', url=BASE + '/')
    return report


def _named(value, table):
    """SETUPS / TRIGGERS / GRABS 里的名字换成它的内容，其余原样"""
    return table.get(value, value) if isinstance(value, str) else value


async def _prepare(name, viewport, path, reduced, init=''):
    """换视口；要换地址、要（或要去掉）减少动态效果时重新打开页面。返回 (size_arg, size_name)。
    上一次 reduced=True 装的模拟留在页面里：这次不要它时重新打开、不带它，再确认真的没了"""
    size_arg, size_name = VIEWPORTS[viewport]
    await devtools('emulate', viewport=size_arg)
    stale = not reduced and await run(REDUCED_CHECK, stable=False) == '0ms'
    if path or reduced or stale:
        url = BASE + path if path else await run('() => location.href')
        await devtools('navigate_page', type='url', url=url, initScript=init + (REDUCED_SCRIPT if reduced else ''))
        await run(_wait_js('main', '', 15000))
    moving = await run(REDUCED_CHECK, stable=False)
    if reduced and moving != '0ms':
        raise RuntimeError(f'{name}：减少动态效果没模拟上')
    if not reduced and moving == '0ms':
        raise RuntimeError(f'{name}：页面还在减少动态效果下（上一次的模拟没去掉，或者系统设置里开着），拍出来的不是正常动效')
    return size_arg, size_name


async def motion(issue, name, viewport, times, *, grab=None, trigger=None, when=None, path=None, setup=None, reduced=False, network=None, on_load=False, count=6):
    """
    动效逐帧：把一个变化里的动画停在 times 里的每个毫秒数拍一张，存成 <name>-f<毫秒>-<宽x高>.png。
      viewport  'phone' | 'desktop' | '768' | '1024'。手机和桌面互换会重新加载页面，播放队列也会丢，所以先换视口再做 setup
      grab      要冻住的元素（CSS 选择器，或 GRABS 里的名字，例如 'page'、'bar'）。
                不写就是换页：trigger 点链接或 history.back()，冻住 View Transition（::view-transition-* 上）的动画，结果里有 types（方向）
      trigger   () => ... 函数（或 TRIGGERS 里的名字，例如 'page-next'），触发变化。等 when 匹配的元素有动画在跑，再把 grab 的动画冻在第 0 毫秒
      when      默认同 grab。例如转圈：grab 是两个图标，when 是 'button > span:has(.lucide-loader-circle)'
      path      先打开这个地址；不写就留在当前页面（要去掉上一次的减少动态效果时重新打开当前地址）
      setup     () => ... 函数（或 SETUPS 里的名字，例如 'play-open'），触发前把页面摆好，返回值放进结果
      reduced   True：模拟“减少动态效果”打开；False 时页面若还在减少动态效果下就重新打开，仍在就报错
      network   'Slow 4G' 这类限速，只在触发时（on_load 时在打开页面时）生效，拍完取消
      on_load   True：重新打开页面（网络图片加随机参数重新下载），冻住 grab 匹配的元素新开始的 CSS 过渡（封面淡入），等冻住 count 个再拍；不用 trigger
    返回：文件名、冻住的动画（时长和动的属性，减少动态效果时应该只剩 opacity、不超过 150ms）、setup 的返回值
    """
    grab, trigger, setup = _named(grab, GRABS), _named(trigger, TRIGGERS), _named(setup, SETUPS)
    when = _named(when, GRABS)
    out_dir = ROOT / '_notes/screenshots' / f'issue-{issue}'
    out_dir.mkdir(parents=True, exist_ok=True)
    size_arg, size_name = VIEWPORTS[viewport]
    extra = REDUCED_SCRIPT if reduced else ''
    try:
        if on_load:
            await devtools('emulate', viewport=size_arg)
            # 先不限速打开，再限速、忽略缓存重新加载，装上“新开始的过渡就冻住”
            if path:
                await devtools('navigate_page', type='url', url=BASE + path)
                await run(_wait_js('main', '', 15000))
            if network:
                await devtools('emulate', viewport=size_arg, networkConditions=network)
            await devtools('navigate_page', type='reload', ignoreCache=True, timeout=30000,
                           initScript=FRESH_IMAGES_SCRIPT + FREEZE_SCRIPT + extra + f'window.__campanulaFreeze.load = {json.dumps(grab)};')
        else:
            await _prepare(name, viewport, path, reduced, FREEZE_SCRIPT)
        await run(f'() => {{ {FREEZE_SCRIPT} return true }}', stable=False)
        if on_load and (await run(REDUCED_CHECK, stable=False) == '0ms') != reduced:
            raise RuntimeError(f'{name}：减少动态效果和要的不一样（reduced={reduced}），拍出来的不是要的状态')
        entry = {'name': name, 'size': size_name}
        if setup:
            entry['setup'] = await run(setup)
        if on_load:
            # 一次 DevTools 调用最多 30 秒，限速时开发服务器的页面要十几秒才画出来：每次等 15 秒，最多等 4 次
            caught = None
            for _ in range(4):
                caught = await run(f'() => window.__campanulaFreeze.waitLoaded({count}, 15000)', stable=False)
                if caught:
                    break
        else:
            if network:
                await devtools('emulate', viewport=size_arg, networkConditions=network)
            wait = f'F.waitAndGrab({json.dumps(grab)}, {json.dumps(when or grab)}, 15000)' if grab else 'F.waitTurn(15000)'
            caught = await run(f"""async () => {{ const F = window.__campanulaFreeze; F.release(); await ({trigger})();
              return await {wait} }}""", stable=False)
        if not caught or not caught.get('anims'):
            raise RuntimeError(f'{name}：等不到 {when or grab or "换页"} 上的动画，没拍')
        entry.update(caught)
        entry['files'] = []
        for t in times:
            await run(f'() => window.__campanulaFreeze.frame({t})', stable=False)
            file = out_dir / f'{name}-f{t}-{size_name}.png'
            await devtools('take_screenshot', filePath=str(file))
            entry['files'].append(file.name)
        return entry
    finally:
        await run('() => window.__campanulaFreeze?.release() ?? true', stable=False)
        if network:
            await devtools('emulate', viewport=size_arg)


# 慢放：Element.prototype.animate（Svelte 过渡、Web Animations）的时长、延迟乘上 factor，CSS 过渡和动画按 1 / factor 的速度走。
# 只在 slow() 里起作用，拍完恢复成 1
SLOW_SCRIPT = """(() => { if (window.__campanulaSlow) return; const S = window.__campanulaSlow = { factor: 1 };
  const animate = Element.prototype.animate;
  Element.prototype.animate = function (keyframes, options) { const f = S.factor;
    if (typeof options === 'number') options *= f;
    else if (options) options = { ...options, duration: (options.duration ?? 0) * f, delay: (options.delay ?? 0) * f };
    return animate.call(this, keyframes, options) };
  const stretch = e => { if (S.factor === 1) return;
    for (const a of e.target.getAnimations()) if ((a instanceof CSSTransition || a instanceof CSSAnimation) && a.playbackRate === 1) a.playbackRate = 1 / S.factor };
  document.addEventListener('transitionrun', stretch, true); document.addEventListener('animationstart', stretch, true) })();"""


async def slow(issue, name, viewport, actions, shots, *, factor=10, path=None, setup=None, reduced=False):
    """
    慢放一串操作，按墙上的时间截图：看连按几次、转到一半又切歌这类打断。动画都放慢 factor 倍。
      actions   [(秒, 触发)…]：触发是 () => ... 函数或 TRIGGERS 里的名字，例如 [(0, 'page-next'), (0.8, 'page-next'), (1.6, 'page-next')]
      shots     [秒…]：大约在这些时刻截图（每次调 DevTools 要一两百毫秒，会晚一点）
      其余参数同 motion。拍完把放慢恢复成 1
    文件存成 <name>-f<毫秒>-<宽x高>.png，毫秒是截图那一刻按慢放折回的动效时刻（factor 10 时墙上 1.2 秒是第 120ms），按实际时刻算
    返回：文件名、setup 的返回值
    """
    setup = _named(setup, SETUPS)
    out_dir = ROOT / '_notes/screenshots' / f'issue-{issue}'
    out_dir.mkdir(parents=True, exist_ok=True)
    _, size_name = await _prepare(name, viewport, path, reduced, SLOW_SCRIPT)
    await run(f'() => {{ {SLOW_SCRIPT} return true }}', stable=False)
    entry = {'name': name, 'size': size_name}
    if setup:
        entry['setup'] = await run(setup)
    events = sorted([(t, 0, _named(js, TRIGGERS)) for t, js in actions] + [(t, 1, None) for t in shots], key=lambda e: (e[0], e[1]))
    entry['files'] = []
    try:
        await run(f'() => {{ window.__campanulaSlow.factor = {factor}; return true }}', stable=False)
        start = time.monotonic()
        for at, kind, js in events:
            await asyncio.sleep(max(0, at - (time.monotonic() - start)))
            if kind == 0:
                await run(f'() => {{ ({js})(); return true }}', stable=False)
                continue
            file = out_dir / f'{name}-f{round((time.monotonic() - start) * 1000 / factor)}-{size_name}.png'
            await devtools('take_screenshot', filePath=str(file))
            entry['files'].append(file.name)
    finally:
        await run('() => { if (window.__campanulaSlow) window.__campanulaSlow.factor = 1; return true }', stable=False)
    return entry


async def hidden(actions, *, grab='page', wait=0.7):
    """
    看不见时不动（DESIGN.md Motion）：页面藏到后台，做 actions（TRIGGERS 里的名字或 () => ... 函数，每个之间等 wait 秒），再回到前台。
    在当前页面上做，先用 setup 把页面摆好（例如 await run(SETUPS['play-open'])）。
    只数 grab（CSS 选择器或 GRABS 里的名字）匹配的元素上新开始的动画：进度线、歌词行这类 CSS 过渡在后台本来就不画，不算。
    返回：后台期间新开始了几个有时长的动画（应为 0）、回来后 300ms 内又新开始了几个（应为 0，不补放）、
    回来时 grab 里每个选择器各匹配几个元素（换碟应该只剩一张封面、一块歌名）
    """
    grab = _named(grab, GRABS)
    # 探测只装一次：monkeypatch 和监听器都读 P.sel，每次调用只换选择器、清零计数
    probe = f"""() => {{ const sel = {json.dumps(grab)};
      if (!window.__campanulaProbe) {{ const P = window.__campanulaProbe = {{ started: 0, sel }}; const animate = Element.prototype.animate;
        const mine = el => el instanceof Element && el.matches(P.sel);
        Element.prototype.animate = function (k, o) {{ const d = typeof o === 'number' ? o : (o?.duration ?? 0) + (o?.delay ?? 0); if (d > 0 && mine(this)) P.started += 1; return animate.call(this, k, o) }};
        for (const type of ['transitionrun', 'animationstart']) document.addEventListener(type, e => {{ if (mine(e.target)) P.started += 1 }}, true) }}
      window.__campanulaProbe.sel = sel; window.__campanulaProbe.started = 0; return true }}"""
    await run(probe, stable=False)
    await run(HIDE_JS, stable=False)
    try:
        for js in actions:
            await run(f'() => {{ ({_named(js, TRIGGERS)})(); return true }}', stable=False)
            await asyncio.sleep(wait)
        during = await run('() => { const n = window.__campanulaProbe.started; window.__campanulaProbe.started = 0; return n }', stable=False)
    finally:
        await run(SHOW_JS, stable=False)
    await asyncio.sleep(0.3)
    after = await run(f"""() => ({{ started: window.__campanulaProbe.started,
      counts: Object.fromEntries({json.dumps([s.strip() for s in grab.split(',')])}.map(s => [s, document.querySelectorAll(s).length])) }})""", stable=False)
    return {'startedWhileHidden': during, 'startedAfterShow': after['started'], 'counts': after['counts']}


def sheet(issue, name, files, crop=None, height=420):
    """
    把一组截图横着拼成一张对照图，存在临时目录（不进截图目录），返回路径：read 一次看完一组。
      files   文件名或 glob（相对 _notes/screenshots/issue-<issue>/），例如 ['play-crossfade-f*-1440x900.png']；带 -f<毫秒> 的按毫秒排
      crop    (左, 上, 右, 下) 按比例裁，例如只看桌面底栏 (0, 0.88, 0.3, 1)
      height  每张缩放到这么高（px）：裁得很小的（播放条）会放大到这个高度，一眼看得清
    """
    try:
        from PIL import Image
    except ImportError as error:
        raise RuntimeError('先在 Python eval 里 %pip install pillow') from error
    shots = ROOT / '_notes/screenshots' / f'issue-{issue}'
    paths = [p for pattern in files for p in sorted(shots.glob(pattern))]
    if not paths:
        raise RuntimeError(f'{shots} 里没有 {files}')
    frame = re.compile(r'-f(\d+)(?:-|$)')
    paths.sort(key=lambda p: (frame.sub('', p.stem), int(m.group(1)) if (m := frame.search(p.stem)) else -1))
    images = []
    for p in paths:
        image = Image.open(p).convert('RGB')
        if crop:
            w, h = image.size
            image = image.crop((int(crop[0] * w), int(crop[1] * h), int(crop[2] * w), int(crop[3] * h)))
        images.append(image.resize((round(image.width * height / image.height), height), Image.LANCZOS))
    board = Image.new('RGB', (sum(i.width for i in images) + 8 * (len(images) - 1), height), 'white')
    x = 0
    for image in images:
        board.paste(image, (x, 0))
        x += image.width + 8
    out = pathlib.Path(tempfile.gettempdir()) / 'campanula-sheets' / f'issue-{issue}' / f'{name}.jpg'
    out.parent.mkdir(parents=True, exist_ok=True)
    board.save(out, quality=80)
    return str(out)
