<p align="center">
  <h1 align="center">dsh-wsl-expose</h1>
  <p align="center">从 <b>WSL2 走 IPv6</b> 经反向代理，把 DeepSeek Harness Web GUI 暴露到公网——一条 <code>/wan</code> 命令搞定。</p>
</p>

[English](README.md) | 中文

## 解决什么问题

DSH Web GUI 只绑定 `127.0.0.1`（`--host 0.0.0.0` 被刻意拒绝），且每个 `/api` 请求都要通过一道按请求 `Host` 校验的浏览器信任围栏。要从手机经 IPv6 访问它——穿过 WSL2 的 NAT 再经局域网反向代理（如 [Lucky](https://lucky666.cn/)）——通常是一串脆弱的手动步骤。

本插件把**运行在你自己机器上**的部分全部自动化：

```
公网 IPv6 用户 ──> 你的域名 (AAAA) ──> Lucky（反向代理）
        └─> [Windows 全局 IPv6]:3082  (portproxy v6tov4)
                └─> WSL eth0:3082     (socat 中继)
                        └─> 127.0.0.1:<web 端口>  (DSH Web GUI)
```

## 自动化了什么

- 探测 WSL2、WSL `eth0` IPv4、以及 Windows 全局 IPv6（经 `netsh.exe`/`ipconfig.exe`）
- 启动 `socat` 回环中继（`TCP-LISTEN:<relayPort> → 127.0.0.1:<webPort>`），detached 运行、重启不丢
- 添加 Windows `netsh interface portproxy v6tov4` 规则（`[WindowsIPv6]:relayPort → WSL:relayPort`）
- 添加 Windows 防火墙入站规则（放行 `relayPort`）
- 把 `connection` 的 **trusted-host** 白名单写进 profile 的 `cordis.patch.yml`，让 403 围栏自动放行你的公网域名（无需手动 `--trusted-host`）

**无法**自动化的部分（插件会打印精确指引）：Lucky 反向代理配置、路由器 IPv6 入站防火墙、DDNS `AAAA` 记录——这些都在*别的机器*上。

## 安装

```sh
dsh plugin --profile web add dsh-wsl-expose
```

重启 `dsh web`，然后在任意会话里执行：

```
/wan up dsh.your-domain.cn
```

## 命令

| 命令 | 作用 |
|---|---|
| `/wan up [域名]` | 建立中继 + portproxy + 防火墙 + trusted-host。域名可省略——读取已保存的值 |
| `/wan set-domain <域名>` | 保存一次域名；之后 `/wan up` 无需再带参数 |
| `/wan get-domain` | 查看当前保存的域名 |
| `/wan set-port <端口>` | 保存中继监听端口（1-65535）；端口变化时自动拆除旧端口的残留 |
| `/wan get-port` | 查看保存的中继端口（及实际生效值） |
| `/wan set-web-port <端口>` | 保存转发目标端口——DSH web 服务在 127.0.0.1 上的端口（默认 3080） |
| `/wan get-web-port` | 查看保存的转发目标端口（及实际生效值） |
| `/wan down` | 全部拆除（也会移除插件管理的 trusted-host 块） |
| `/wan status` | 查看当前状态 |
| `/wan doctor` | 诊断链路（含经典的 Lucky `io timeout`） |

## 设置域名和端口——界面或命令，二选一或混用

界面和命令读写的是**同一份持久化设置**（`settings.yaml` 里的 `wsl-expose` 命名空间）。

**界面**：重启 `dsh web` 后，打开 **Settings → Plugins → dsh-wsl-expose**——编辑域名、中继端口、转发端口和 trusted-host 开关，点保存即可。

**命令**：

```
/wan set-domain dsh.your-domain.cn
/wan set-port 3082        # 可选——中继监听端口（默认 3082）
/wan set-web-port 3080    # 可选——转发目标（默认 3080）
```

之后直接 `/wan up`（不带参数）。值持久化在插件的 settings 命名空间（`wsl-expose`）里，重启不丢。解析优先级——域名：**命令行参数 → 已保存设置 → 配置里的 `domain`**；端口：**已保存设置 → 配置 → 默认值（3082 / 3080）**。

## 配置（文件 / profile）

更低层的选项写在 profile 的 `cordis.patch.yml`（用户补丁层）：

```yaml
- id: dsh-wsl-expose
  config:
    mode: ipv6              # 'ipv6'（v6tov4，默认）或 'ipv4'（v4tov4）
    relayPort: 3082         # Lucky 指向的端口（默认 3082）
    domain: dsh.your-domain.cn   # 命令行参数和 UI 设置都未给时的兜底默认值
    windowsAddress: ''      # 自动探测选错时，手动指定 Windows 监听地址
```

`mode: 'ipv4'` 监听 Windows **局域网 IPv4**（Lucky 上游 `http://<WindowsIPv4>:3082`）；`mode: 'ipv6'` 监听 Windows **全局 IPv6**（上游 `http://[<WindowsIPv6>]:3082`）。

`webPort` 会自动从正在运行的 webserver 读取；配置里的 `webPort` 只是兜底。

## 前置条件

- WSL 里装有 **socat**：`sudo apt install socat`
- Windows 的 **IP Helper** 服务在运行（`netsh portproxy` 依赖 `iphlpsvc`）
- Windows 和 Lucky 机器都拿到**全局** IPv6 前缀（不是 `fe80::`）
- 局域网另一台机器上装了 **Lucky**（或任意反向代理）

## 插件打印的手动步骤（Lucky / 路由器 / DDNS）

1. **Lucky**：加反向代理规则——上游 `http://[<WindowsIPv6>]:3082`，监听 `80`/`443`，并**透传原始 Host 头**（不要改写成上游地址）。
2. **路由器**：放行到 Lucky 机器的 IPv6 入站 `80`/`443`（IPv6 无 NAT，这里是防火墙放行，不是端口转发）。
3. **DDNS**：把 `AAAA` 记录指向你家 IPv6 前缀（Lucky 自带 DDNS 模块）。

`/wan up` 之后，重启一次 `dsh web` 让 trusted-host 围栏生效。

## 安全

`--trusted-host` / trusted-host 围栏**不是身份认证**——它只防 DNS rebinding 和跨站请求。把 DSH 暴露到公网等于暴露一个能执行命令的 agent。公开之前，务必在 Lucky 层加真正的鉴权（密码 / Basic Auth / IP 白名单）。

## 排障

- **Lucky 报 `io timeout`** → 运行 `/wan doctor`。十有八九是：Windows IPv6 变了、`iphlpsvc` 停了、或防火墙规则缺失。在 Lucky 机器上 `curl -v --connect-timeout 5 "http://[<WindowsIPv6>]:3082"`（**别用 ping**——Windows 默认丢弃 ICMPv6 echo）。
- **工作区 403** → 域名还没进 trusted-host 白名单。确认 `/wan up` 已写入，然后重启 `dsh web`。
- **socat 起不来** → 先装 socat，或 `relayPort` 已被占用。

## License

MIT
