import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import process from 'node:process';

import { createGenerator } from 'unocss';

import config from '../uno.config.mts';

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'src');
const TOKENS_FILE = join(SRC, 'lib/components/shared/motion-tokens.ts');

const RAW_MOTION = /\b\d+(?:\.\d+)?m?s\b|cubic-bezier\(/g;
const CSS_KEYWORD_EASING = /(?<![\w-])ease(?:-in|-out)?(?![\w-])/g;
const STYLE_BLOCK = /(<style[^>]*>)([\s\S]*?)(<\/style>)/g;
const APPLY = /^(?:@apply|--at-apply:|--uno:)/;

interface Finding {
  file: string;
  line: number;
  text: string;
  why: string;
}

// 注释换成空格、保留换行：行号不变，注释里可以照常写“200ms”
const blankComments = (code: string): string => {
  const blank = (match: string) => match.replace(/[^\n]/g, ' ');
  return code
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(?<![:'"`\\])\/\/[^\n]*/g, blank);
};

// <style> 里是 CSS 不是类名：换成空格，只留 @apply / --at-apply 后面的类名
const blankStyleExceptApply = (code: string): string =>
  code.replace(
    STYLE_BLOCK,
    (_, open: string, css: string, close: string) =>
      open +
      css.replace(/(?:@apply|--at-apply:|--uno:)[^;}]*|[^\n]/g, (kept) =>
        APPLY.test(kept) ? kept : ' ',
      ) +
      close,
  );

const lineOf = (code: string, index: number): number =>
  code.slice(0, index).split('\n').length;

const escapeRegExp = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(?:svelte|ts)$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));

const uno = await createGenerator(config);

const blockedReason = async (raw: string): Promise<string | null> => {
  const reason = (hit: NonNullable<ReturnType<typeof uno.getBlocked>>) => {
    const message = hit[1]?.message;
    return typeof message === 'function'
      ? message(raw)
      : (message ?? 'uno.config.ts 的 blocklist');
  };
  const direct = uno.getBlocked(raw);
  if (direct) return reason(direct);
  for (const matched of await uno.matchVariants(raw)) {
    const hit = matched && uno.getBlocked(matched[1]);
    if (hit) return reason(hit);
  }
  return null;
};

const check = async (file: string): Promise<Finding[]> => {
  const code = blankComments(readFileSync(file, 'utf8'));
  const name = relative(ROOT, file);
  const findings: Finding[] = [];

  const markup = blankStyleExceptApply(code);
  for (const token of await uno.applyExtractors(markup, file)) {
    const why = await blockedReason(token);
    if (!why) continue;
    const at = new RegExp(`(?<![\\w:-])${escapeRegExp(token)}(?![\\w-])`, 'g');
    for (const match of markup.matchAll(at)) {
      findings.push({
        file: name,
        line: lineOf(markup, match.index),
        text: token,
        why,
      });
    }
  }

  if (file !== TOKENS_FILE) {
    for (const match of code.matchAll(RAW_MOTION)) {
      findings.push({
        file: name,
        line: lineOf(code, match.index),
        text: match[0],
        why: '时长、曲线只写在 src/lib/components/shared/motion-tokens.ts，这里用 var(--duration-…) / var(--move-…) / var(--ease-…) 或 DURATIONS',
      });
    }
  }

  for (const style of code.matchAll(STYLE_BLOCK)) {
    const start = style.index + style[1].length;
    for (const match of style[2].matchAll(CSS_KEYWORD_EASING)) {
      findings.push({
        file: name,
        line: lineOf(code, start + match.index),
        text: match[0],
        why: '曲线写 var(--ease-out-soft) / var(--ease-in-soft)；来回循环可以用 ease-in-out、linear',
      });
    }
  }
  return findings;
};

const targets =
  process.argv.length > 2
    ? process.argv
        .slice(2)
        .map((file) => resolve(file))
        .filter((file) => file.startsWith(SRC) && /\.(?:svelte|ts)$/.test(file))
    : sourceFiles(SRC);

const findings = (await Promise.all(targets.map(check)))
  .flat()
  .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

if (findings.length > 0) {
  for (const f of findings)
    console.error(`${f.file}:${f.line}  ${f.text}  ${f.why}`);
  console.error(
    `\n${findings.length} 处没用设计系统的档位（DESIGN.md · Motion「写在哪」）`,
  );
  process.exit(1);
}
console.log(`设计令牌检查通过：${targets.length} 个文件`);
