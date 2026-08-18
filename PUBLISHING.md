# Publishing dsh-wsl-expose

The plugin ships as plain ESM JavaScript (no build step) — `lib/` is the
source of truth. Publishing = npm package + GitHub repo + one registry entry.

## 1. GitHub repo

```sh
cd dsh-wsl-expose
git init && git add -A && git commit -m "dsh-wsl-expose: WSL2 IPv6/IPv4 reverse-proxy exposure"
# create the repo on GitHub, then:
git remote add origin git@github.com:jack-ranbo/dsh-wsl-expose.git
git branch -M main
git push -u origin main
```

## 2. npm publish

```sh
npm login          # once
npm publish --access public
```

`schemastery`, `dsh-home-paths`, and `dsh-settings` are declared as regular
dependencies, so they install automatically. `@deepseek-ai/cordis` and
`@deepseek-ai/dsh-commands` are peer dependencies (provided by the DSH
profile itself).

## 3. List in the plugin market

The market (dshmarket) reads the curated
[awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)
registry. Open a PR there adding **one entry**:

```json
{
  "name": "dsh-wsl-expose",
  "owner": "jack-ranbo",
  "url": "https://github.com/jack-ranbo/dsh-wsl-expose",
  "category": "network",
  "description": {
    "en": "Expose the DSH Web GUI over IPv6 or IPv4 from WSL2 through a reverse proxy (Lucky): /wan up sets up the socat relay, Windows portproxy (v4tov4 or v6tov4), firewall, and trusted-host fence.",
    "zh": "从 WSL2 走 IPv6/IPv4 经反向代理（Lucky）把 DSH Web GUI 暴露到公网：/wan up 一键建立 socat 中继、Windows portproxy、防火墙与 trusted-host 白名单，域名与端口持久化配置。"
  },
  "npm": "dsh-wsl-expose",
  "install": "dsh plugin --profile web add dsh-wsl-expose",
  "added": "2026-08-18"
}
```

The site and the in-app market pick it up automatically (usually within a day).
