<p align="center">
  <h1 align="center">dsh-wsl-expose</h1>
  <p align="center">Expose the DeepSeek Harness Web GUI to the public internet from <b>WSL2 over IPv6</b> through a reverse proxy — one <code>/wan</code> command.</p>
</p>

English | [中文](README.zh.md)

## What problem it solves

DSH's Web GUI binds to `127.0.0.1` only (`--host 0.0.0.0` is intentionally refused), and every `/api` request must pass a browser-trust fence keyed to the request `Host`. Reaching it from a phone over IPv6 — through WSL2's NAT plus a LAN reverse proxy like [Lucky](https://lucky666.cn/) — normally takes a chain of fragile manual steps.

This plugin automates everything that runs *on your machine*:

```
public IPv6 user ──> your domain (AAAA) ──> Lucky (reverse proxy)
        └─> [Windows global IPv6]:3082  (portproxy v6tov4)
                └─> WSL eth0:3082       (socat relay)
                        └─> 127.0.0.1:<web port>  (DSH Web GUI)
```

## What it automates

- Detects WSL2, the WSL `eth0` IPv4, and Windows global IPv6 (via `netsh.exe`/`ipconfig.exe`)
- Starts the `socat` loopback relay (`TCP-LISTEN:<relayPort> → 127.0.0.1:<webPort>`), detached so it survives restarts
- Adds the Windows `netsh interface portproxy v6tov4` rule (`[WindowsIPv6]:relayPort → WSL:relayPort`)
- Adds the Windows firewall inbound rule for `relayPort`
- Writes the `connection` **trusted-host** override into the profile's `cordis.patch.yml`, so the 403 fence accepts your public domain automatically (no `--trusted-host` flag needed)

What it **cannot** automate (it prints exact instructions instead): Lucky reverse-proxy config, router IPv6 inbound firewall, and DDNS `AAAA` records — those live on *other* machines.

## Install

```sh
dsh plugin --profile web add dsh-wsl-expose
```

Restart `dsh web`, then in any conversation run:

```
/wan up dsh.your-domain.cn
```

## Commands

| Command | Action |
|---|---|
| `/wan up [domain]` | Set up relay + portproxy + firewall + trusted-host. The domain is optional — reads the saved one |
| `/wan set-domain <d>` | Save the domain once; then `/wan up` needs no argument |
| `/wan get-domain` | Show the saved domain |
| `/wan set-port <p>` | Save the relay port (1-65535); tears down the old port's artifacts when it changes |
| `/wan get-port` | Show the saved relay port (and the effective one) |
| `/wan set-web-port <p>` | Save the forward port — the DSH web server's port on 127.0.0.1 (default 3080) |
| `/wan get-web-port` | Show the saved forward port (and the effective one) |
| `/wan down` | Tear it all down (removes the managed trusted-host block too) |
| `/wan status` | Show current state |
| `/wan doctor` | Diagnose the chain (including the classic Lucky `io timeout`) |

## Set the domain and ports — UI or commands

Both surfaces read and write the **same persisted settings** (the `wsl-expose` namespace in `settings.yaml`).

**UI**: after restarting `dsh web`, open **Settings → Plugins → dsh-wsl-expose** — edit the domain, relay port, forward port, and the trusted-host fence switch; Save commits them.

**Commands**:

```sh
/wan set-domain dsh.your-domain.cn
/wan set-port 3082        # optional — relay listen port (default 3082)
/wan set-web-port 3080    # optional — forward target (default 3080)
```

Then just `/wan up` (no argument). The values are persisted in the plugin's settings namespace (`wsl-expose`), so they survive restarts. Resolution order — domain: **CLI arg → saved setting → config `domain`**; ports: **saved setting → config → defaults (3082 / 3080)**.

## Configuration (file / profile)

Lower-level options live in the profile's `cordis.patch.yml` (the user patch layer):

```yaml
- id: dsh-wsl-expose
  config:
    mode: ipv6          # 'ipv6' (v6tov4, default) or 'ipv4' (v4tov4)
    relayPort: 3082     # port Lucky points at (default 3082)
    domain: dsh.your-domain.cn   # fallback default when neither CLI arg nor UI setting is set
    windowsAddress: ''  # pin the Windows listen address if auto-detect picks the wrong one
```

`mode: 'ipv4'` listens on the Windows **LAN IPv4** (Lucky upstream `http://<WindowsIPv4>:3082`); `mode: 'ipv6'` listens on the Windows **global IPv6** (upstream `http://[<WindowsIPv6>]:3082`).

`webPort` is auto-detected from the running webserver; the config `webPort` is only a fallback.

## Prerequisites

- **socat** in WSL: `sudo apt install socat`
- Windows **IP Helper** service running (`netsh portproxy` depends on `iphlpsvc`)
- A global IPv6 prefix (not just `fe80::`) assigned to Windows and the Lucky host
- **Lucky** (or any reverse proxy) on another LAN machine

## Manual steps the plugin prints (Lucky / router / DDNS)

1. **Lucky**: add a reverse-proxy rule — upstream `http://[<WindowsIPv6>]:3082`, listen on `80`/`443`, and **pass the original Host header through** (do not rewrite to the upstream address).
2. **Router**: allow inbound IPv6 to the Lucky host on `80`/`443` (IPv6 has no NAT, so this is a *firewall allow*, not port forwarding).
3. **DDNS**: point an `AAAA` record at your home IPv6 prefix (Lucky has a built-in DDNS module).

After `/wan up`, restart `dsh web` once so the trusted-host fence picks up the new domain.

## Security

`--trusted-host` / the trusted-host fence is **not authentication** — it only defeats DNS-rebinding and cross-site requests. Exposing DSH to the internet exposes an agent that can run commands. Add real auth at the Lucky layer (password / Basic Auth / IP allowlist) **before** opening it publicly.

## Troubleshooting

- **Lucky reports `io timeout`** → run `/wan doctor`. Almost always one of: the Windows IPv6 changed, `iphlpsvc` is stopped, or the firewall rule is missing. Test from the Lucky host with `curl -v --connect-timeout 5 "http://[<WindowsIPv6>]:3082"` (do **not** use `ping` — Windows drops ICMPv6 echo by default).
- **403 on the workspace** → the domain isn't in the trusted-host fence yet. Confirm `/wan up` wrote it and restart `dsh web`.
- **`socat` won't start** → install it, or `relayPort` is already in use.

## License

MIT
