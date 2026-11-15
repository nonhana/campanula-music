import { Buffer } from 'node:buffer';
import { randomUUID, X509Certificate } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import {
  mkdir,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { confirm, intro, isCancel, log, outro } from '@clack/prompts';
import { execa, getCancelSignal, getOneMessage, sendMessage } from 'execa';
import type { RunnableDevEnvironment, ViteDevServer } from 'vite';

import {
  certificateFiles,
  ensureCertificateFiles,
  validateTlsFiles,
} from './dev/certificates.mts';
import type { TlsFiles } from './dev/certificates.mts';
import {
  createWorkspace,
  launchEnvironment,
  ownRoot,
  SOURCE,
} from './dev/environment.mts';
import type { ProcessEnvironmentOptions } from './dev/environment.mts';
import { requestURL } from './dev/http.mts';
import { runTerminalCommand } from './dev/terminal.mts';

const modes = {
  product: {
    hostname: 'local.campanula.test',
    httpsPort: 8443,
    httpHost: 'localhost',
    httpPort: 5173,
  },
  mock: {
    hostname: 'mock.campanula.test',
    httpsPort: 8444,
    httpHost: '127.0.0.1',
    httpPort: 5174,
  },
};

const developmentTlsDirectory = () =>
  resolve(SOURCE, process.env.CAMPANULA_DEV_TLS_DIR ?? '.campanula/tls');

export const developmentSettings = (
  mode: 'product' | 'mock',
  { http = false, port }: { http?: boolean; port?: number } = {},
) => {
  const selected = modes[mode];
  const external =
    !http && process.env.CAMPANULA_DEV_ORIGIN
      ? new URL(process.env.CAMPANULA_DEV_ORIGIN)
      : undefined;
  if (external && external.protocol !== 'https:')
    throw new Error(
      'HTTPS 入口需要 https:；HTTP 请使用 dev:http / dev:mock:http',
    );
  const resolvedPort =
    port ??
    (external
      ? Number(external.port || 443)
      : Number(
          (!http && process.env.CAMPANULA_HTTPS_PORT) ||
            (http ? selected.httpPort : selected.httpsPort),
        ));
  if (
    !Number.isInteger(resolvedPort) ||
    resolvedPort < 0 ||
    resolvedPort > 65535
  )
    throw new Error('端口需要 0–65535');
  if (external && external.hostname !== selected.hostname)
    throw new Error(`本模式的开发域名为 ${selected.hostname}`);
  if (!http && resolvedPort === 0)
    throw new Error('HTTPS 入口需要固定端口，请用 --port 指定 1–65535');
  const hostname =
    external?.hostname ?? (http ? selected.httpHost : selected.hostname);
  return {
    mode,
    http,
    hostname,
    port: resolvedPort,
    origin: `${http ? 'http' : 'https'}://${hostname}${resolvedPort === (http ? 80 : 443) ? '' : `:${resolvedPort}`}`,
    tlsDir: developmentTlsDirectory(),
  };
};

export { createWorkspace, SOURCE };
export type EnvironmentOptions = Omit<
  ProcessEnvironmentOptions,
  'workerFile' | 'httpHost' | 'inheritEnv' | 'ownerRoot' | 'syntheticSession'
> & { development?: boolean };

export const startEnvironment = (options: EnvironmentOptions) =>
  launchEnvironment({
    ...options,
    workerFile: fileURLToPath(import.meta.url),
    httpHost: modes[options.mode].httpHost,
    inheritEnv: options.development && options.mode === 'product',
    ownerRoot:
      options.development && options.mode === 'product'
        ? join(options.root ?? SOURCE, '.campanula/run-product')
        : undefined,
    syntheticSession: !options.development,
  });

const runWorker = async () => {
  const signal = await getCancelSignal();
  const { mode, port, root, tls, syntheticSession } =
    (await getOneMessage()) as {
      mode: string;
      port: number;
      root: string;
      tls?: { cert: string; key: string; ca: string };
      syntheticSession?: boolean;
    };
  let server: ViteDevServer | undefined;
  let coverage: (() => Promise<void>) | undefined;
  let closing: Promise<void> | undefined;
  const close = (code = 0) =>
    (closing ??= (async () => {
      await server?.close();
      await coverage?.();
      process.exit(code);
    })());
  signal.addEventListener(
    'abort',
    () => {
      void close();
    },
    { once: true },
  );
  if (signal.aborted) return close();
  try {
    if (mode !== 'product' && mode !== 'mock')
      throw new Error('无效的开发模式');
    const { createServer, mergeConfig } = await import('vite');
    const { default: productConfig } = await import('../vite.config.mts');
    const plugins =
      mode === 'mock'
        ? [(await import('../tests/_kit/mock/vite-plugin.ts')).mockPlugin()]
        : [];
    const { startSsrCoverage } = await import('../tests/coverage/ssr.ts');
    if (process.env.CAMPANULA_SSR_COVERAGE_DIR)
      coverage = await startSsrCoverage(process.env.CAMPANULA_SSR_COVERAGE_DIR);
    server = await createServer(
      mergeConfig(productConfig, {
        configFile: false,
        root,
        envDir: root,
        cacheDir: 'node_modules/.vite',
        server: {
          host: tls ? '127.0.0.1' : modes[mode].httpHost,
          ...(tls
            ? {
                https: {
                  cert: await readFile(tls.cert),
                  key: await readFile(tls.key),
                },
              }
            : {}),
          port,
          strictPort: true,
          watch: { followSymlinks: false },
          fs: {
            allow: [root, await realpath(join(root, 'src')), SOURCE],
          },
        },
        plugins,
      }),
    );
    server.watcher.add(await realpath(join(root, 'src')));
    await server.listen();
    const address = server.httpServer!.address() as { port: number };
    const baseURL = tls
      ? process.env.CAMPANULA_DEV_ORIGIN!
      : `http://${modes[mode].httpHost}:${address.port}`;
    let sessionCookie = '';
    if (syntheticSession) {
      const runner = (server.environments.ssr as RunnableDevEnvironment).runner;
      const credentials = (await runner.import(
        new URL('../src/lib/server/credentials.ts', import.meta.url).pathname,
      )) as typeof import('../src/lib/server/credentials.ts');
      const now = Date.now;

      try {
        Date.now = () => 0;
        sessionCookie = credentials.loginCookieHeader('synthetic-device', {
          MUSIC_U: 'synthetic-product-session',
        });
      } finally {
        Date.now = now;
      }
    }
    await sendMessage({ baseURL, sessionCookie });
  } catch (error) {
    console.error(error);
    try {
      await sendMessage({ error: String(error) });
    } finally {
      await close(1);
    }
  }
};

export { certificateFiles };
export type { TlsFiles };
const renewalWindow = 30 * 24 * 60 * 60 * 1000;
const validateCertificate = (files: TlsFiles, now: number, remaining = 0) =>
  validateTlsFiles(
    files,
    Object.values(modes).map((mode) => mode.hostname),
    now,
    remaining,
  );
export const ensureDevelopmentCertificate = (options: {
  tlsDir: string;
  caRoot: string;
  mkcertBinary?: string;
  now?: number;
  signal?: AbortSignal;
}) =>
  ensureCertificateFiles({
    ...options,
    mkcertBinary: options.mkcertBinary ?? 'mkcert',
    hosts: Object.values(modes).map((mode) => mode.hostname),
    renewBefore: renewalWindow,
  });

export { requestURL };

export const requestDevelopment = async (
  url: string,
  options: Parameters<typeof requestURL>[1] = {},
) => {
  const address = new URL(url);
  if (
    address.protocol !== 'https:' ||
    !Object.values(modes).some((mode) => mode.hostname === address.hostname)
  )
    return fetch(url, options);
  const files = await certificateFiles(developmentTlsDirectory());
  return requestURL(url, { ...options, ca: await readFile(files.ca) });
};

export const checkDevelopmentDns = async (
  hostname: string | string[],
  resolveAddresses: (
    hostname: string,
  ) => Promise<{ address: string; family: number }[]> = (hostname) =>
    lookup(hostname, { all: true }),
): Promise<void> => {
  if (Array.isArray(hostname)) {
    for (const name of hostname)
      await checkDevelopmentDns(name, resolveAddresses);
    return;
  }
  let addresses: { address: string; family: number }[];
  try {
    addresses = await resolveAddresses(hostname);
  } catch {
    throw new Error(
      `${hostname} 没有解析到本机；请运行 pnpm dev:setup 完成 hosts / DNS 准备`,
    );
  }
  if (
    !addresses.some((value) => value.address === '127.0.0.1') ||
    addresses.some(({ address }) => !['127.0.0.1', '::1'].includes(address))
  )
    throw new Error(
      `${hostname} 解析到 ${addresses.map((value) => value.address).join(', ')}，需要指向 127.0.0.1。请运行 pnpm dev:setup；使用 TUN / VPN 时检查 Fake-IP 设置。`,
    );
};

const confirmAction = async (message: string, signal: AbortSignal) => {
  signal.throwIfAborted();
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new Error(
      '首次准备需要交互终端确认系统修改；请在交互终端运行 pnpm dev:setup。自动化应显式提供 --cert / --key / --ca。',
    );
  const answer = await confirm({
    message,
    initialValue: false,
    signal,
    output: process.stdout,
  });
  if (isCancel(answer) || !answer)
    throw new DOMException(
      '已取消首次准备，可运行 pnpm dev:setup 重试',
      'AbortError',
    );
};

const resolveMkcert = async (signal: AbortSignal) => {
  const platform = (
    { darwin: 'darwin', linux: 'linux', win32: 'windows' } as Record<
      string,
      string
    >
  )[process.platform];
  const arch = ({ x64: 'amd64', arm64: 'arm64' } as Record<string, string>)[
    process.arch
  ];
  const name = `mkcert-v1.4.4-${platform}-${arch}${process.platform === 'win32' ? '.exe' : ''}`;
  const cached = join(SOURCE, '.campanula/tools', name);
  for (const binary of [process.env.CAMPANULA_MKCERT ?? 'mkcert', cached]) {
    try {
      await execa(binary, ['-version'], {
        cancelSignal: signal,
        killDescendants: true,
      });
      return binary;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  if (!platform || !arch)
    throw new Error('此平台请先安装 mkcert，再运行 pnpm dev:setup');
  await confirmAction(
    `未找到 mkcert。下载官方 v1.4.4 到项目的 .campanula/tools？`,
    signal,
  );
  const pending = `${cached}.${randomUUID()}.tmp`;
  await mkdir(dirname(cached), { recursive: true, mode: 0o700 });
  try {
    log.step('下载 mkcert v1.4.4', { output: process.stdout });
    const response = await fetch(
      `https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/${name}`,
      { signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]) },
    );
    if (!response.ok)
      throw new Error(
        `mkcert 下载失败：HTTP ${response.status}；也可自行安装 mkcert 后重试`,
      );
    await writeFile(pending, Buffer.from(await response.arrayBuffer()), {
      mode: 0o755,
      signal,
    });
    const version = await execa(pending, ['-version'], {
      cancelSignal: signal,
      killDescendants: true,
    });
    if (!`${version.stdout}${version.stderr}`.includes('v1.4.4'))
      throw new Error('下载的 mkcert 版本不匹配');
    await rename(pending, cached);
    return cached;
  } finally {
    await rm(pending, { force: true });
  }
};

const prepareCertificate = async (
  tlsDir: string,
  signal: AbortSignal,
  setup = false,
) => {
  const receiptPath = join(tlsDir, 'trusted.json');
  let receipt: { caRoot: string; fingerprint: string } | undefined;
  try {
    const saved = JSON.parse(await readFile(receiptPath, 'utf8'));
    if (
      typeof saved?.caRoot === 'string' &&
      typeof saved?.fingerprint === 'string'
    )
      receipt = saved;
  } catch (error) {
    if (
      !(error instanceof SyntaxError) &&
      (error as NodeJS.ErrnoException).code !== 'ENOENT'
    )
      throw new Error(
        '本地信任记录无法读取，请检查权限或重新运行 pnpm dev:setup',
        { cause: error },
      );
  }
  let trusted = false;
  if (
    receipt &&
    (!process.env.CAROOT ||
      resolve(process.env.CAROOT) === resolve(receipt.caRoot))
  ) {
    try {
      const authority = new X509Certificate(
        await readFile(join(receipt.caRoot, 'rootCA.pem')),
      );
      trusted =
        authority.fingerprint256 === receipt.fingerprint &&
        authority.ca &&
        Date.parse(authority.validTo) > Date.now();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  let binary = process.env.CAMPANULA_MKCERT ?? 'mkcert';
  if (!trusted || setup) {
    await confirmAction(
      '首次 HTTPS 准备将使用本机 mkcert CA，并安装或复核系统信任；可能需要系统密码。是否继续？',
      signal,
    );
    binary = await resolveMkcert(signal);
    log.step('安装或复核本机 CA 信任', { output: process.stdout });
    await runTerminalCommand(binary, ['-install'], { signal });
    const { stdout } = await execa(binary, ['-CAROOT'], {
      cancelSignal: signal,
      killDescendants: true,
    });
    const caRoot = stdout.trim();
    const authority = new X509Certificate(
      await readFile(join(caRoot, 'rootCA.pem')),
    );
    if (!authority.ca || Date.parse(authority.validTo) <= Date.now())
      throw new Error(
        '本机 mkcert CA 已失效，请显式更换并重新信任 CA；不会静默删除旧 CA',
      );
    receipt = { caRoot, fingerprint: authority.fingerprint256 };
    await mkdir(tlsDir, { recursive: true, mode: 0o700 });
    const pending = join(tlsDir, `.trusted-${randomUUID()}.json`);
    try {
      await writeFile(pending, JSON.stringify(receipt), {
        mode: 0o600,
        signal,
      });
      await rename(pending, receiptPath);
    } finally {
      await rm(pending, { force: true });
    }
  }
  if (!receipt) throw new Error('缺少本地 CA 准备记录，请运行 pnpm dev:setup');
  let reusable = false;
  try {
    const existing = await validateCertificate(
      await certificateFiles(tlsDir),
      Date.now(),
      renewalWindow,
    );
    reusable = existing.fingerprint === receipt.fingerprint;
  } catch (error) {
    if (
      ['EPERM', 'EACCES'].includes((error as NodeJS.ErrnoException).code ?? '')
    )
      throw error;
  }
  if (!reusable) binary = await resolveMkcert(signal);
  const files = await ensureDevelopmentCertificate({
    tlsDir,
    caRoot: receipt.caRoot,
    mkcertBinary: binary,
    signal,
  });
  log.success(
    files.reused
      ? '已复用有效站点证书和本机 CA'
      : '已使用原 CA 签发站点证书，后续启动自动复用',
    { output: process.stdout },
  );
  return files;
};

export const prepareDevelopmentCertificate = async (
  tlsDir: string,
  signal: AbortSignal,
  setup = false,
) => {
  const release = await ownRoot(join(tlsDir, '.preparation'), {
    signal,
    wait: 120_000,
  });
  try {
    return await prepareCertificate(tlsDir, signal, setup);
  } finally {
    await release();
  }
};

const prepareDevelopmentDns = async (
  hostname: string | string[],
  signal: AbortSignal,
) => {
  try {
    await checkDevelopmentDns(hostname);
    return;
  } catch (error) {
    log.warn((error as Error).message, { output: process.stdout });
  }
  if (!['darwin', 'linux'].includes(process.platform))
    throw new Error('请在系统 hosts 中将两个开发域名指向 127.0.0.1 后重试');
  const hosts = await readFile('/etc/hosts', 'utf8');
  const names = Object.values(modes).map((mode) => mode.hostname);
  const entries = hosts
    .split('\n')
    .map((line) => line.split('#')[0]!.trim().split(/\s+/));
  if (
    entries.some(
      (parts) =>
        parts.slice(1).some((name) => names.includes(name)) &&
        parts[0] !== '127.0.0.1',
    )
  )
    throw new Error(
      '/etc/hosts 中已有冲突的开发域名映射，请手动改为 127.0.0.1；不会覆盖已有配置',
    );
  const missing = names.filter(
    (name) =>
      !entries.some(
        (parts) => parts[0] === '127.0.0.1' && parts.slice(1).includes(name),
      ),
  );
  if (missing.length) {
    await confirmAction(
      `将 ${missing.join('、')} 添加到 /etc/hosts，指向 127.0.0.1？可能需要系统密码。`,
      signal,
    );
    await runTerminalCommand('sudo', ['tee', '-a', '/etc/hosts'], {
      input: `\n# Campanula local development\n127.0.0.1 ${missing.join(' ')}\n`,
      signal,
    });
  } else
    await confirmAction(
      'hosts 已包含开发域名。是否刷新本机 DNS 缓存后重新检查？',
      signal,
    );
  if (process.platform === 'darwin') {
    await runTerminalCommand('sudo', ['dscacheutil', '-flushcache'], {
      signal,
    });
    await runTerminalCommand('sudo', ['killall', '-HUP', 'mDNSResponder'], {
      signal,
    });
  }
  await checkDevelopmentDns(hostname);
};

const main = async () => {
  const args = process.argv.slice(2);
  const { values } = parseArgs({
    args,
    options: {
      mock: { type: 'boolean' },
      http: { type: 'boolean' },
      setup: { type: 'boolean' },
      'print-config': { type: 'boolean' },
      help: { type: 'boolean' },
      port: { type: 'string' },
      host: { type: 'string' },
      cert: { type: 'string' },
      key: { type: 'string' },
      ca: { type: 'string' },
      'skip-dns-check': { type: 'boolean' },
    },
  });
  if (values.help) {
    console.log(
      'pnpm dev [--mock] [--http] [--setup] [--port 8443]\n--print-config 输出地址配置。--cert / --key / --ca 使用指定证书。--skip-dns-check 用于客户端自行解析的环境。',
    );
    return;
  }
  if (values.host && !['127.0.0.1', 'localhost'].includes(values.host))
    throw new Error('开发服务器仅监听本机回环地址');
  if (values.http && values.setup)
    throw new Error('--setup 准备 HTTPS，不能与 --http 一起使用');
  const mode = values.mock ? 'mock' : 'product';
  const settings = developmentSettings(mode, {
    http: values.http,
    ...(values.port !== undefined ? { port: Number(values.port) } : {}),
  });
  if (values['print-config']) {
    console.log(JSON.stringify(settings));
    return;
  }
  const controller = new AbortController();
  const stop = () => controller.abort();
  // 异步收尾完成前保留监听，避免子进程库把信号重新发送给启动器。
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  let environment: Awaited<ReturnType<typeof startEnvironment>> | undefined;
  intro(`Campanula · ${mode === 'mock' ? 'Mock' : 'Dev'}`, {
    output: process.stdout,
  });
  try {
    let tls: TlsFiles | undefined;
    if (!settings.http) {
      const provided = [values.cert, values.key, values.ca];
      if (provided.some(Boolean)) {
        if (!provided.every(Boolean))
          throw new Error('--cert / --key / --ca 需要一起提供');
        tls = {
          cert: resolve(values.cert!),
          key: resolve(values.key!),
          ca: resolve(values.ca!),
        };
        await validateCertificate(tls, Date.now());
        log.step('使用调用方指定的证书，不安装系统 CA', {
          output: process.stdout,
        });
      } else
        tls = await prepareDevelopmentCertificate(
          settings.tlsDir,
          controller.signal,
          values.setup,
        );
      if (!values['skip-dns-check'])
        await prepareDevelopmentDns(
          values.setup
            ? Object.values(modes).map((mode) => mode.hostname)
            : settings.hostname,
          controller.signal,
        );
      else
        log.info('已显式略过系统解析检查；客户端仍需自行解析开发域名', {
          output: process.stdout,
        });
    }

    if (values.setup) {
      log.success('首次准备完成；现在可以直接运行 pnpm dev / pnpm dev:mock', {
        output: process.stdout,
      });
      return;
    }
    log.step('正在启动开发服务器', { output: process.stdout });
    environment = await startEnvironment({
      mode,
      development: true,
      root:
        mode === 'mock'
          ? resolve(
              SOURCE,
              process.env.CAMPANULA_DEV_MOCK_ROOT ?? '.campanula/mock',
            )
          : process.cwd(),
      port: settings.port,
      signal: controller.signal,
      tls,
      source: process.env.CAMPANULA_DEV_SOURCE ?? SOURCE,
      ...(settings.http ? {} : { origin: settings.origin }),
      onLog: (message) =>
        log.message(message.trimEnd(), { output: process.stdout }),
    });
    log.success(
      `Ready: ${environment.baseURL}${mode === 'mock' ? '/mock/login' : '/'}\nroot=${environment.root} pid=${environment.pid}`,
      { output: process.stdout },
    );
    await environment.finished;
    if (!controller.signal.aborted && environment.exitCode !== 0)
      throw new Error('开发服务器异常退出');
  } catch (error) {
    if (controller.signal.aborted || (error as Error).name === 'AbortError') {
      if (error instanceof AggregateError)
        log.warn(error.message, { output: process.stdout });
      log.info('已取消启动', { output: process.stdout });
      process.exitCode = 130;
    } else {
      log.error(error instanceof Error ? error.message : String(error), {
        output: process.stdout,
      });
      process.exitCode = 1;
    }
  } finally {
    await environment?.close();
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    outro('Stopped · 已释放本次运行的端口和工作锁', { output: process.stdout });
  }
};

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (process.argv.includes('--worker')) {
    if (!process.send) throw new Error('worker 入口需要由启动器派生');
    await runWorker();
  } else
    await main().catch((error) => {
      log.error(error instanceof Error ? error.message : String(error), {
        output: process.stdout,
      });
      process.exitCode = 1;
    });
}
