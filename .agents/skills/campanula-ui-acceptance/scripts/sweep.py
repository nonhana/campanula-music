# 一次 eval 拍完一批验收截图（Python eval 里 `%load .agents/skills/campanula-ui-acceptance/scripts/sweep.py`）。
# 每张：换视口 → 写拦截规则、按需清空本机副本 → 打开页面 → 等到页面画出来 → 跑检查 → 截图存文件。
# 只把每张的检查结果打回上下文，图片留在文件里，要看哪张再单独 read。
import json
import pathlib
import subprocess

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


async def devtools(name, **args):
    """调一个 Chrome DevTools 工具，返回它的文字结果"""
    result = await tool.write(path=f'xd://mcp__chrome_devtools_{name}', content=json.dumps({'pageId': PAGE, **args}), i=f'DevTools {name}')
    return result['text'] if isinstance(result, dict) else str(result)


async def run(js):
    """在页面里跑一段 () => ... 的函数，返回它的 JSON 结果（返回 undefined 时是 None）"""
    text = await devtools('evaluate_script', function=js)
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
        await devtools('navigate_page', type='url', url=BASE + shot['path'], initScript=INIT_SCRIPT)
        waited = await run(_wait_js(shot.get('ready', 'main'), shot.get('text', ''), 15000))
        if not waited['ready']:
            raise RuntimeError(f"{shot['name']}：等了 15 秒，页面没出现 {shot.get('ready', 'main')} {shot.get('text', '')}，截出来的不是要的画面")
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
