# 一次 eval 拍完一批验收截图（Python eval 里 `%load .agents/skills/campanula-ui-acceptance/scripts/sweep.py`）。
# shoot：静态画面。每张：换视口 → 写拦截规则、按需清空本机副本 → 打开页面 → 等到页面画出来 → 跑检查 → 截图存文件。
# motion：动效逐帧。触发一个变化，把动画停在第 0 / 60 / 120… 毫秒各拍一张。sheet：把一组截图拼成一张，read 一次看完。
# 只把每张的检查结果打回上下文，图片留在文件里，要看哪张再单独 read。
import json
import pathlib
import subprocess
import tempfile

ROOT = pathlib.Path(subprocess.run(['git', 'rev-parse', '--show-toplevel'], capture_output=True, text=True, check=True).stdout.strip())
BASE = 'http://localhost:5173'
PAGE = 1  # list_pages 里作者那个 Chrome 标签页的编号
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

# 冻结动画：抓到的动画（Svelte 过渡、CSS 过渡；不含转圈、骨架这类循环）停在第 t 毫秒。
# load 设成选择器时，页面一加载就把这些元素新开始的 CSS 过渡冻住（封面淡入）
FREEZE_SCRIPT = """(() => { if (window.__campanulaFreeze) return;
  const next = () => new Promise(r => requestAnimationFrame(r));
  const F = window.__campanulaFreeze = { frozen: [], at: 0, load: null,
    hold(a) { if (a instanceof CSSAnimation || F.frozen.includes(a)) return; a.pause(); a.currentTime = F.at; F.frozen.push(a) },
    grab(selector) { for (const el of document.querySelectorAll(selector)) for (const a of el.getAnimations()) F.hold(a); return F.frozen.length },
    frame(t) { F.at = t; for (const a of F.frozen) a.currentTime = t; return F.frozen.length },
    describe() { return F.frozen.map(a => a.effect.getTiming().duration + 'ms ' + [...new Set(a.effect.getKeyframes().flatMap(k => Object.keys(k)).filter(x => !['offset', 'computedOffset', 'easing', 'composite'].includes(x)))].join(',')) },
    release() { F.load = null; for (const a of F.frozen) { try { a.finish() } catch {} } F.frozen = []; F.at = 0; return true },
    async waitAndGrab(grab, when, timeout) { const t0 = performance.now();
      const live = () => [...document.querySelectorAll(when)].some(el => el.getAnimations().some(a => !(a instanceof CSSAnimation) && a.playState === 'running'));
      while (!live()) { if (performance.now() - t0 > timeout) return null; await next() }
      for (let i = 0; i < 3; i++) { F.grab(grab); await next() }
      F.frame(0); return { afterMs: Math.round(performance.now() - t0), anims: F.describe() } },
    async waitLoaded(count, timeout) { const t0 = performance.now();
      while (F.frozen.length < count && performance.now() - t0 < timeout) await new Promise(r => setTimeout(r, 100));
      if (F.frozen.length < count) return null;
      await new Promise(r => setTimeout(r, 400)); F.frame(0); return { frozen: F.frozen.length, anims: [...new Set(F.describe())] } } };
  document.addEventListener('transitionrun', e => { if (F.load && e.target.matches?.(F.load)) for (const a of e.target.getAnimations()) F.hold(a) }, true) })();"""

# 拍“图片加载完淡入”时让每张网络图片都重新下载：地址后面加一个随机参数。不加的话，
# 刚看过的图在浏览器内存缓存里，挂上时已经加载好，App 照规矩直接显示、不淡入（ignoreCache 的重新加载管不到后来才插进来的图）
FRESH_IMAGES_SCRIPT = """(() => { const tag = '_fresh=' + Date.now();
  const fresh = v => typeof v === 'string' && /^https?:/.test(v) && !v.includes('_fresh=') ? v + (v.includes('?') ? '&' : '?') + tag : v;
  const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  Object.defineProperty(HTMLImageElement.prototype, 'src', { ...src, set(v) { src.set.call(this, fresh(v)) } });
  const setAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (n, v) { return setAttribute.call(this, n, this instanceof HTMLImageElement && n === 'src' ? fresh(v) : v) } })();"""


async def devtools(name, **args):
    """调一个 Chrome DevTools 工具，返回它的文字结果"""
    result = await tool.write(path=f'xd://mcp__chrome_devtools_{name}', content=json.dumps({'pageId': PAGE, **args}), i=f'DevTools {name}')
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
      act       截图前在页面里跑的 () => ... 函数（输入、点击、滚动），它的返回值放进结果
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
            entry['act'] = await run(shot['act'])
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


async def motion(issue, name, viewport, times, *, grab, trigger=None, when=None, path=None, setup=None, reduced=False, network=None, on_load=False, count=6):
    """
    动效逐帧：把一个变化里的动画停在 times 里的每个毫秒数拍一张，存成 <name>-f<毫秒>-<宽x高>.png。
      viewport  'phone' | 'desktop' | '768' | '1024'。手机和桌面互换会重新加载页面，播放队列也会丢，所以先换视口再做 setup
      grab      要冻住的元素（CSS 选择器），例如播放键里的两个图标 'div.fixed.bottom-0 button > span'
      trigger   () => ... 函数，触发变化（点一下）。等 when 匹配的元素有动画在跑，再把 grab 的动画冻在第 0 毫秒
      when      默认同 grab。例如转圈：grab 是两个图标，when 是 'button > span:has(.lucide-loader-circle)'
      path      先打开这个地址；reduced、on_load 时不写就是当前地址
      setup     () => ... 函数，触发前把页面摆好（例如放一首歌再停下），返回值放进结果
      reduced   True：模拟“减少动态效果”打开
      network   'Slow 4G' 这类限速，只在触发时（on_load 时在打开页面时）生效，拍完取消
      on_load   True：重新打开页面（网络图片加随机参数重新下载），冻住 grab 匹配的元素新开始的 CSS 过渡（封面淡入），等冻住 count 个再拍；不用 trigger
    返回：文件名、冻住的动画（时长和动的属性，减少动态效果时应该只剩 opacity、不超过 150ms）、setup 的返回值
    """
    out_dir = ROOT / '_notes/screenshots' / f'issue-{issue}'
    out_dir.mkdir(parents=True, exist_ok=True)
    size_arg, size_name = VIEWPORTS[viewport]
    await devtools('emulate', viewport=size_arg)
    extra = REDUCED_SCRIPT if reduced else ''
    try:
        if on_load:
            # 先不限速打开，再限速、忽略缓存重新加载，装上“新开始的过渡就冻住”
            if path:
                await devtools('navigate_page', type='url', url=BASE + path)
                await run(_wait_js('main', '', 15000))
            if network:
                await devtools('emulate', viewport=size_arg, networkConditions=network)
            await devtools('navigate_page', type='reload', ignoreCache=True, timeout=30000,
                           initScript=FRESH_IMAGES_SCRIPT + FREEZE_SCRIPT + extra + f'window.__campanulaFreeze.load = {json.dumps(grab)};')
        elif path or reduced:
            url = BASE + path if path else await run('() => location.href')
            await devtools('navigate_page', type='url', url=url, initScript=FREEZE_SCRIPT + extra)
            await run(_wait_js('main', '', 15000))
        await run(f'() => {{ {FREEZE_SCRIPT} return true }}', stable=False)
        if reduced and await run(REDUCED_CHECK, stable=False) != '0ms':
            raise RuntimeError(f'{name}：减少动态效果没模拟上')
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
            caught = await run(f"""async () => {{ const F = window.__campanulaFreeze; F.release(); await ({trigger})();
              return await F.waitAndGrab({json.dumps(grab)}, {json.dumps(when or grab)}, 15000) }}""", stable=False)
        if not caught or not caught.get('anims'):
            raise RuntimeError(f'{name}：等不到 {when or grab} 上的动画，没拍')
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


def sheet(issue, name, files, crop=None, height=420):
    """
    把一组截图横着拼成一张对照图，存在临时目录（不进截图目录），返回路径：read 一次看完一组。
      files   文件名或 glob（相对 _notes/screenshots/issue-<issue>/），例如 ['play-crossfade-f*-1440x900.png']；带 -f<毫秒> 的按毫秒排
      crop    (左, 上, 右, 下) 按比例裁，例如只看桌面底栏 (0, 0.88, 0.3, 1)
    """
    try:
        from PIL import Image
    except ImportError as error:
        raise RuntimeError('先在 Python eval 里 %pip install pillow') from error
    import re
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
        image.thumbnail((10_000, height))
        images.append(image)
    board = Image.new('RGB', (sum(i.width for i in images) + 8 * (len(images) - 1), max(i.height for i in images)), 'white')
    x = 0
    for image in images:
        board.paste(image, (x, 0))
        x += image.width + 8
    out = pathlib.Path(tempfile.gettempdir()) / 'campanula-sheets' / f'issue-{issue}' / f'{name}.jpg'
    out.parent.mkdir(parents=True, exist_ok=True)
    board.save(out, quality=70)
    return str(out)
