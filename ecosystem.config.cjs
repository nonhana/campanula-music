const os = require('node:os');
const path = require('node:path');
const process = require('node:process');

const customEnvFile = process.env.CAMPANULA_ENV_FILE?.trim();
const envFile =
  customEnvFile || path.join(os.homedir(), 'campanula-config', 'runtime.env');

module.exports = {
  apps: [
    {
      name: 'campanula',
      script: './build/index.js',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      kill_timeout: 5000,
      // 交由 Node 原生读取 runtime.env，避免把 COOKIE_SECRET 序列化进 PM2 dump，且重启即生效
      node_args: [
        `${customEnvFile ? '--env-file' : '--env-file-if-exists'}=${envFile}`,
      ],
      env: {
        NODE_ENV: 'production',
        HOST: process.env.HOST || '127.0.0.1',
        PORT: process.env.PORT || '3000',
      },
    },
  ],
};
