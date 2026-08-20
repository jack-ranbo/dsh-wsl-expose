/**
 * dsh-wsl-expose — host plugin exposing the DSH Web GUI over IPv6 from WSL2
 * through a reverse proxy.
 *
 * Registers the `/wan` slash command (up / down / status / doctor) and drives
 * the socat relay, Windows portproxy, firewall rule, and trusted-host fence.
 */

import z from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import {
  FIREWALL_RULE_NAME,
  firewallAdd,
  firewallDelete,
  firewallExists,
  hasSocat,
  isWsl,
  portproxyAdd,
  portproxyDelete,
  portproxyLineHasPort,
  portproxyList,
  readTrustedHost,
  relayListening,
  run,
  socatStart,
  socatStop,
  upstreamUrl,
  userPatchPath,
  verifyRelay,
  windowsAddresses,
  writeTrustedHost,
  wslIPv4,
  yn,
} from './engine.js'

export const name = 'dsh-wsl-expose'
export const inject = ['commands']

/** Settings namespace the UI renders as a configurable form card. */
export const SETTINGS_NAMESPACE = 'wsl-expose'

/** Settings namespace schema (UI-editable fields). */
const SettingsSchema = z.object({
  /** Public domain for `/wan up`; saved here so the UI configures it once. */
  domain: z.string().default(''),
  /** Relay port for `/wan up`; saved via /wan set-port (no default — absence falls back to config). */
  relayPort: z.natural().max(65535),
  /** Forward target port (DSH web server on 127.0.0.1); saved via /wan set-web-port. */
  webPort: z.natural().max(65535),
  /** Whether `/wan up` should also write the trusted-host fence entry (OFF by default). */
  fence: z.boolean().default(false),
})

/** Plugin configuration (settable in the profile's cordis.yml). */
export const Config = z.object({
  /** Which Windows side the portproxy listens on: 'ipv6' (v6tov4) or 'ipv4' (v4tov4). */
  mode: z.union([z.const('ipv6'), z.const('ipv4')]).default('ipv6'),
  /** TCP port the socat relay listens on (Lucky points here). */
  relayPort: z.natural().max(65535).default(3082),
  /** Fallback web port when the live webserver port cannot be resolved. */
  webPort: z.natural().max(65535).default(3080),
  /** Default public authority for `/wan up` when none is passed. */
  domain: z.string().default(''),
  /** Override the Windows listen address the portproxy binds (auto-detected by mode). */
  windowsAddress: z.string().default(''),
})

const USAGE = [
  '/wan up [domain]     set up the relay + portproxy + firewall + trusted-host',
  '/wan down            tear everything down',
  '/wan set-domain <d>  save the domain so /wan up needs no argument',
  '/wan get-domain      show the saved domain',
  '/wan set-port <p>    save the relay port (1-65535)',
  '/wan get-port        show the saved relay port',
  '/wan set-web-port <p>  save the forward port (DSH web server, default 3080)',
  '/wan get-web-port    show the saved forward port',
  '/wan status          show current state',
  '/wan doctor          diagnose connectivity',
].join('\n')

/** Merge plugin config with schema defaults (defensive against partial configs). */
function resolveConfig(config) {
  return {
    mode: config.mode === 'ipv4' ? 'ipv4' : 'ipv6',
    relayPort: config.relayPort ?? 3082,
    webPort: config.webPort ?? 3080,
    domain: config.domain ?? '',
    windowsAddress: config.windowsAddress ?? '',
  }
}

/** Resolve the profile name the host process booted (`web` fallback). */
function argvProfile() {
  const argv = process.argv.slice(2)
  const flag = argv.indexOf('--profile')
  if (flag !== -1 && flag + 1 < argv.length && !argv[flag + 1].startsWith('-')) {
    return argv[flag + 1]
  }
  if (argv[0] === 'web') return 'web'
  return 'web'
}

/** Read the saved settings value from the registered scope (undefined when unset). */
function readSettings(scope) {
  try {
    return scope?.get() ?? undefined
  } catch {
    return undefined
  }
}

/** Resolve the effective domain, preferring CLI arg → saved setting → config default. */
function resolveDomain(scope, config, cliDomain) {
  if (cliDomain && cliDomain.trim() !== '') return cliDomain.trim()
  const settings = readSettings(scope)
  const fromSettings = settings?.domain
  if (fromSettings && fromSettings.trim() !== '') return fromSettings.trim()
  return (config.domain ?? '').trim()
}

/** Resolve the effective relay port: saved setting → config → 3082. */
function resolveRelayPort(scope, config) {
  const saved = readSettings(scope)?.relayPort
  if (Number.isInteger(saved) && saved >= 1 && saved <= 65535) return saved
  const fromConfig = config.relayPort
  if (Number.isInteger(fromConfig) && fromConfig >= 1 && fromConfig <= 65535) return fromConfig
  return 3082
}

/**
 * Resolve the forward target port (where the DSH web server listens on
 * 127.0.0.1): saved setting → config → 3080. Deliberately NOT auto-detected
 * from the live webserver: the default is a fixed, predictable 3082 → 3080.
 */
function resolveWebPort(scope, config) {
  const saved = readSettings(scope)?.webPort
  if (Number.isInteger(saved) && saved >= 1 && saved <= 65535) return saved
  const fromConfig = config.webPort
  if (Number.isInteger(fromConfig) && fromConfig >= 1 && fromConfig <= 65535) return fromConfig
  return 3080
}

function parseArgs(rawInput) {
  const parts = (rawInput ?? '').trim().split(/\s+/u).filter(Boolean)
  const action = parts[0] ?? ''
  const domain = parts[1]
  return { action, domain }
}

async function doUp(ctx, config, domain, scope) {
  const d = resolveDomain(scope, config, domain)
  if (!d || d.trim() === '') {
    return {
      kind: 'error',
      text: `No domain configured. Either pass one (/wan up <domain>) or run /wan set-domain <domain>.\n\n${USAGE}`,
    }
  }

  const relayPort = resolveRelayPort(scope, config)
  const webPort = resolveWebPort(scope, config)
  const mode = config.mode
  const lines = []

  // Self-forward guard: a relay that forwards to its own listen port loops
  // forever (each connection forks another socat — a process storm that
  // returned 502 for every request).
  if (relayPort === webPort) {
    return {
      kind: 'error',
      text: `relay port (${relayPort}) and web port (${webPort}) must differ — forwarding to itself loops forever. Fix with /wan set-port or /wan set-web-port.\n\n${USAGE}`,
    }
  }

  if (!isWsl()) {
    lines.push('⚠ Not running under WSL — the portproxy/firewall steps need a Windows host; continuing anyway.')
  }
  if (!(await hasSocat())) {
    lines.push('⚠ socat is not installed. Install it first (e.g. `sudo apt install socat`).')
  }

  const wsl = wslIPv4()
  if (!wsl) {
    return {
      kind: 'error',
      text: 'Could not detect a WSL IPv4 interface. Run `ip -4 addr` to check.',
    }
  }
  lines.push(`WSL interface: ${wsl.iface} = ${wsl.address}`)

  const candidates = await windowsAddresses(mode)
  const winAddr = config.windowsAddress || candidates[0]
  const label = mode === 'ipv4' ? 'Windows IPv4' : 'Windows IPv6'
  if (!winAddr) {
    lines.push(mode === 'ipv4'
      ? '⚠ No Windows LAN IPv4 detected. Check ipconfig for a 192.168.x / 10.x address.'
      : '⚠ No Windows global IPv6 detected. Check that the router assigns a global (240e:/2408:) prefix.')
  } else {
    lines.push(`${label}: ${winAddr}`)
    if (candidates.length > 1) lines.push(`  (other candidates: ${candidates.filter((a) => a !== winAddr).join(', ')})`)
  }

  // 1. socat relay — idempotent, but an existing listener is VERIFIED: a
  // stale relay can survive a set-web-port change and keep forwarding to a
  // dead target (or, historically, to itself), so a listener that no longer
  // reaches DSH gets replaced when it is ours to replace.
  const alreadyListening = await relayListening(relayPort)
  if (alreadyListening) {
    const probe = await run('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', '--connect-timeout', '4', `http://127.0.0.1:${relayPort}`])
    if (probe.code === 0 && probe.stdout === '200') {
      lines.push(`socat relay: already listening on ${relayPort} and verified`)
    } else {
      const pg = await run('pgrep', ['-f', `TCP-LISTEN:${relayPort}[,]`])
      if (pg.stdout.trim() !== '') {
        await socatStop(relayPort)
        lines.push(`socat relay: stale listener on ${relayPort} failed the check (http ${probe.stdout || 'n/a'}) — replaced`)
        const socatPid = socatStart(relayPort, webPort)
        const check = await verifyRelay(relayPort, socatPid)
        lines.push(check.listening && check.alive
          ? `socat relay: listening on ${relayPort} → 127.0.0.1:${webPort} (verified, pid ${socatPid})`
          : `⚠ socat relay: FAILED to restart on ${relayPort} — check that socat is installed and the port is free`)
      } else {
        lines.push(`⚠ port ${relayPort} is listening but does not reach DSH and is not a socat relay — another process owns the port`)
      }
    }
  } else {
    const socatPid = socatStart(relayPort, webPort)
    const check = await verifyRelay(relayPort, socatPid)
    if (check.listening && check.alive) {
      lines.push(`socat relay: listening on ${relayPort} → 127.0.0.1:${webPort} (verified, pid ${socatPid})`)
    } else if (check.listening) {
      lines.push(`⚠ socat relay: port ${relayPort} is listening, but the spawned socat (pid ${socatPid}) died — another process owns the port`)
    } else {
      lines.push(`⚠ socat relay: FAILED to start on ${relayPort} — check that socat is installed and the port is free`)
    }
  }

  // 2. Windows portproxy (mode-aware: v4tov4 or v6tov4 → WSL IPv4)
  if (winAddr) {
    const pp = await portproxyAdd(relayPort, winAddr, wsl.address, mode)
    const suffix = pp.replaced ? ' (replaced a stale rule)' : ''
    lines.push(pp.code === 0
      ? `Windows portproxy (${mode === 'ipv4' ? 'v4tov4' : 'v6tov4'}): ${mode === 'ipv4' ? winAddr : `[${winAddr}]`}:${relayPort} → ${wsl.address}:${relayPort}${suffix}`
      : `Windows portproxy: FAILED — ${pp.stderr.trim() || pp.stdout.trim() || 'unknown error'}`)
  } else {
    lines.push(`Windows portproxy: skipped (no ${mode === 'ipv4' ? 'IPv4' : 'IPv6'} detected)`)
  }

  // 3. Windows firewall (upsert: dedups any stale rules under our name first)
  const fw = await firewallAdd(relayPort)
  const fwSuffix = fw.replaced ? ' (replaced existing rule(s))' : ''
  lines.push(fw.code === 0
    ? `Windows firewall: allowed inbound TCP ${relayPort} (rule "${FIREWALL_RULE_NAME}")${fwSuffix}`
    : `Windows firewall: FAILED — ${fw.stderr.trim() || fw.stdout.trim() || 'unknown error'}`)

  // 4. trusted-host fence — OFF by default. The /api trust fence is NOT an
  // auth layer: opening it for a public host lets any reachable client call
  // the full host API, which collides with secure remote access (pairing,
  // a reverse proxy with real auth, etc.). Only write it when the user
  // explicitly enables `fence` in settings.
  const settings = readSettings(scope)
  const wantFence = settings?.fence === true
  const patchPath = userPatchPath(argvProfile())
  if (wantFence) {
    const wrote = writeTrustedHost(patchPath, d.trim())
    lines.push(wrote.ok
      ? `trusted-host: "${wrote.domain}" written to ${patchPath} (restart dsh web to apply)`
      : `trusted-host: FAILED — ${wrote.reason}`)
  } else {
    lines.push('trusted-host: skipped (fence is OFF by default — enable it in Settings → dsh-wsl-expose only if you add real auth at the reverse-proxy layer)')
  }

  lines.push('', '── Next: Lucky + network ──')
  if (winAddr) {
    lines.push(`• Lucky upstream:  ${upstreamUrl(winAddr, mode, relayPort)}`)
    lines.push(`• Lucky listen:    80 / 443, host header passthrough = "${d.trim()}"`)
  }
  if (mode === 'ipv4') {
    lines.push('• Router: port-forward public 80/443 → Lucky LAN IPv4 80/443 (or put Lucky in DMZ)')
    lines.push(`• DDNS:   point an A record at your public IPv4 (e.g. ${d.trim()})`)
  } else {
    lines.push('• Router: allow inbound IPv6 to the Lucky host on 80/443')
    lines.push(`• DDNS:   point an AAAA record at your home IPv6 prefix (e.g. ${d.trim()})`)
  }
  lines.push('• After restarting dsh web, open:  https://' + d.trim())
  lines.push('', 'Security: add real auth (password/whitelist) at the Lucky layer — the trusted-host fence is not authentication.')

  return { kind: 'success', text: lines.join('\n') }
}

/** Tear down every relay artifact bound to one port (socat, portproxy, firewall). */
async function teardownPort(relayPort, mode, windowsAddress, lines) {
  await socatStop(relayPort)
  lines.push(`socat relay on ${relayPort}: stopped`)

  const list = await portproxyList()
  const entry = list.split(/\r?\n/u).find((l) => portproxyLineHasPort(l, relayPort))
  let removed = false
  if (entry) {
    // Try the configured address plus every detected address of the active
    // mode as the listen address; delete the first that matches.
    const candidates = [...new Set([windowsAddress, ...(await windowsAddresses(mode))].filter(Boolean))]
    for (const addr of candidates) {
      const res = await portproxyDelete(relayPort, addr, mode)
      if (res.code === 0) {
        removed = true
        lines.push(`Windows portproxy: removed ${mode === 'ipv4' ? addr : `[${addr}]`}:${relayPort}`)
        break
      }
    }
  }
  if (!removed) lines.push(`Windows portproxy: nothing to remove for port ${relayPort} (or it was already gone)`)

  const fw = await firewallDelete()
  lines.push(fw.code === 0
    ? `Windows firewall: rule "${FIREWALL_RULE_NAME}" removed`
    : `Windows firewall: no rule to remove (or already gone)`)
}

async function doDown(config, scope) {
  const relayPort = resolveRelayPort(scope, config)
  const lines = []
  await teardownPort(relayPort, config.mode, config.windowsAddress, lines)

  const wrote = writeTrustedHost(userPatchPath(argvProfile()), '')
  lines.push(wrote.ok
    ? 'trusted-host: removed managed block from cordis.patch.yml'
    : `trusted-host: ${wrote.reason}`)

  return { kind: 'success', text: lines.join('\n') }
}

async function doStatus(config, scope) {
  const relayPort = resolveRelayPort(scope, config)
  const mode = config.mode
  const patchPath = userPatchPath(argvProfile())
  const [listening, wsl, addresses, pp, fw] = await Promise.all([
    relayListening(relayPort),
    Promise.resolve(wslIPv4()),
    windowsAddresses(mode),
    portproxyList(),
    firewallExists(),
  ])
  const domain = readTrustedHost(patchPath)

  return {
    kind: 'success',
    text: [
      '── dsh-wsl-expose status ──',
      `mode:           ${mode} (portproxy ${mode === 'ipv4' ? 'v4tov4' : 'v6tov4'})`,
      `WSL:            ${yn(isWsl())}`,
      `WSL IPv4:       ${wsl ? `${wsl.iface} = ${wsl.address}` : '(none detected)'}`,
      `Windows ${mode === 'ipv4' ? 'IPv4' : 'IPv6'}:   ${addresses.length ? addresses.join(', ') : '(none detected)'}`,
      `relay port:     ${relayPort} listening=${yn(listening)}`,
      `portproxy:      ${pp.trim() ? pp.trim().split(/\r?\n/u).filter((l) => portproxyLineHasPort(l, relayPort)).join('\n                ') || '(none for this port)' : '(none)'}`,
      `firewall rule:  ${yn(fw)}`,
      `trusted-host:   ${domain ?? '(not set)'}`,
      '',
      USAGE,
    ].join('\n'),
  }
}

async function doDoctor(ctx, config, scope) {
  const relayPort = resolveRelayPort(scope, config)
  const mode = config.mode
  const webPort = resolveWebPort(scope, config)
  const lines = ['── dsh-wsl-expose doctor ──']

  const wsl = isWsl()
  lines.push(`${wsl ? '✓' : '✗'} running under WSL`)

  const wslIp = wslIPv4()
  lines.push(`${wslIp ? '✓' : '✗'} WSL IPv4 (${wslIp?.address ?? 'none'})`)

  const addresses = await windowsAddresses(mode)
  lines.push(`${addresses.length ? '✓' : '✗'} Windows ${mode === 'ipv4' ? 'LAN IPv4' : 'global IPv6'} (${addresses.join(', ') || 'none'})`)
  if (!addresses.length) {
    lines.push(mode === 'ipv4'
      ? '    → check ipconfig for a 192.168.x / 10.x LAN address'
      : '    → router must assign a global 240e:/2408: prefix; fe80:: is not routable')
  }

  const listening = await relayListening(relayPort)
  lines.push(`${listening ? '✓' : '✗'} socat relay listening on ${relayPort}`)
  if (!listening) lines.push(`    → run: /wan up <domain>`)

  const probe = await run('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', `--connect-timeout`, '4', `http://127.0.0.1:${webPort}`])
  lines.push(`${probe.code === 0 && probe.stdout === '200' ? '✓' : '✗'} DSH web reachable at 127.0.0.1:${webPort} (http ${probe.stdout || 'n/a'})`)

  lines.push('', 'If Lucky reports io timeout, test from the Lucky host:')
  lines.push(`  ${mode === 'ipv4' ? `curl -v --connect-timeout 5 "http://<WindowsIPv4>:${relayPort}"` : `curl -v --connect-timeout 5 "http://[<WindowsIPv6>]:${relayPort}"`}`)
  if (mode === 'ipv6') lines.push('  ping is NOT a reliable test — Windows drops ICMPv6 echo by default.')
  lines.push(`  Use curl/TCP against the port, and verify the Windows ${mode === 'ipv4' ? 'IPv4' : 'IPv6'} has not changed.`)

  return { kind: 'success', text: lines.join('\n') }
}

export function apply(ctx, config = {}) {
  const cfg = resolveConfig(config)

  // Register the UI-editable settings namespace and keep its writable scope.
  // When a settings provider exists (web profile), /wan set-domain and the
  // future UI card both write through this scope; the resolved value is what
  // `/wan up` reads back.
  let settingsScope = null
  try {
    ctx.inject(['settings'], (settingsCtx) => {
      settingsScope = settingsCtx.settings.register(settingsNamespace(SETTINGS_NAMESPACE), SettingsSchema)
    })
  } catch {
    /* no settings service — UI config unavailable, CLI arg still works */
  }

  async function setDomain(domain) {
    if (!settingsScope) return { kind: 'error', text: 'no settings provider — this profile cannot persist the domain' }
    const d = (domain ?? '').trim()
    if (d === '') return { kind: 'error', text: 'usage: /wan set-domain <domain>' }
    await settingsScope.update({ domain: d })
    return { kind: 'success', text: `domain saved: ${d}\n\n/wan up will now use it (or pass a domain to override).` }
  }

  function getDomain() {
    if (!settingsScope) return { kind: 'error', text: 'no settings provider — domain cannot be read' }
    const d = settingsScope.get()?.domain
    return { kind: 'success', text: d ? `domain: ${d}` : 'domain: (not set — use /wan set-domain <domain>)' }
  }

  async function setPort(raw) {
    if (!settingsScope) return { kind: 'error', text: 'no settings provider — this profile cannot persist the port' }
    const text = (raw ?? '').trim()
    const parsed = Number(text)
    if (text === '' || !Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
      return { kind: 'error', text: 'usage: /wan set-port <1-65535>' }
    }
    // If the saved port changes, tear down the old port's artifacts so the
    // switch does not leave an orphan relay / portproxy rule behind.
    const old = settingsScope.get()?.relayPort
    const notes = []
    if (Number.isInteger(old) && old !== parsed) {
      notes.push(`old relay on ${old} torn down`)
      await teardownPort(old, cfg.mode, cfg.windowsAddress, [])
    }
    await settingsScope.update({ relayPort: parsed })
    notes.push(`relay port saved: ${parsed}`)
    notes.push('/wan up will now use it (Lucky upstream: this port).')
    return { kind: 'success', text: notes.join('\n') }
  }

  function getPort() {
    if (!settingsScope) return { kind: 'error', text: 'no settings provider — port cannot be read' }
    const saved = settingsScope.get()?.relayPort
    const effective = resolveRelayPort(settingsScope, cfg)
    return {
      kind: 'success',
      text: saved
        ? `relay port: ${saved} (effective: ${effective})`
        : `relay port: (not saved — effective ${effective} from config; use /wan set-port <port>)`,
    }
  }

  async function setWebPort(raw) {
    if (!settingsScope) return { kind: 'error', text: 'no settings provider — this profile cannot persist the web port' }
    const text = (raw ?? '').trim()
    const parsed = Number(text)
    if (text === '' || !Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
      return { kind: 'error', text: 'usage: /wan set-web-port <1-65535>' }
    }
    await settingsScope.update({ webPort: parsed })
    return { kind: 'success', text: `web port saved: ${parsed}\n\nsocat will now forward to 127.0.0.1:${parsed} on the next /wan up.` }
  }

  function getWebPort() {
    if (!settingsScope) return { kind: 'error', text: 'no settings provider — web port cannot be read' }
    const saved = settingsScope.get()?.webPort
    const effective = resolveWebPort(settingsScope, cfg)
    return {
      kind: 'success',
      text: saved
        ? `web port: ${saved} (effective: ${effective})`
        : `web port: (not saved — effective ${effective} from config; use /wan set-web-port <port>)`,
    }
  }

  ctx.commands.register({
    name: 'wan',
    description: 'expose the DSH Web GUI over IPv6 or IPv4 from WSL through a reverse proxy (up/down/status/doctor)',
    input: { hint: '[up <domain>|down|set-domain <d>|get-domain|set-port <p>|get-port|set-web-port <p>|get-web-port|status|doctor]' },
    handler: async (invocation) => {
      const { action, domain } = parseArgs(invocation.rawInput)
      try {
        switch (action) {
          case 'up': return await doUp(ctx, cfg, domain, settingsScope)
          case 'down': return await doDown(cfg, settingsScope)
          case 'set-domain': return await setDomain(domain)
          case 'get-domain': return getDomain()
          case 'set-port': return await setPort(domain)
          case 'get-port': return getPort()
          case 'set-web-port': return await setWebPort(domain)
          case 'get-web-port': return getWebPort()
          case 'status': return await doStatus(cfg, settingsScope)
          case 'doctor': return await doDoctor(ctx, cfg, settingsScope)
          case '': return { kind: 'success', text: USAGE }
          default: return { kind: 'error', text: `Unknown action "${action}".\n\n${USAGE}` }
        }
      } catch (error) {
        return {
          kind: 'error',
          text: `dsh-wsl-expose failed: ${error instanceof Error ? error.message : String(error)}`,
        }
      }
    },
  })
}
