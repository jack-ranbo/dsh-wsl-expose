/**
 * dsh-wsl-expose engine — the WSL2 + IPv6 + reverse-proxy relay machinery.
 *
 * Every command here runs from inside the DSH host process, which lives in
 * WSL2 (Linux). Windows-side facts and mutations are reached through WSL's
 * interop layer by calling `netsh.exe` / `ipconfig.exe` directly — exactly
 * the commands the manual flow used.
 *
 * This module is pure: it takes paths/ports/addresses as arguments and never
 * imports Cordis, so it is testable without a running harness.
 */

import { execFile, spawn } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'

const execFileP = promisify(execFile)

/** Fixed firewall rule name; teardown removes it by this exact name. */
export const FIREWALL_RULE_NAME = 'DSH WSL Expose (IPv6)'

/** Marker comments delimiting the managed block in cordis.patch.yml. */
export const MANAGED_START = '# --- dsh-wsl-expose managed (auto-generated; do not edit) ---'
export const MANAGED_END = '# --- end dsh-wsl-expose managed ---'

/**
 * Run one command, capturing output; never throws on a non-zero exit.
 * @returns { code, stdout, stderr } with `code === 0` on success.
 */
export async function run(cmd, args, options = {}) {
  try {
    const { stdout, stderr } = await execFileP(cmd, args, {
      encoding: 'utf8',
      timeout: options.timeout ?? 20000,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
      ...options.exec ?? {},
    })
    return { code: 0, stdout, stderr }
  } catch (error) {
    return {
      code: typeof error?.code === 'number' ? error.code : 1,
      stdout: error?.stdout ?? '',
      stderr: error?.stderr ?? '',
      error,
    }
  }
}

// ── detection ────────────────────────────────────────────────────────────────

/** True when this process runs under WSL (native `/proc/version` probe). */
export function isWsl() {
  try {
    const v = readFileSync('/proc/version', 'utf8').toLowerCase()
    return v.includes('microsoft') || v.includes('wsl')
  } catch {
    return false
  }
}

/** Whether the `socat` binary is available on PATH. */
export async function hasSocat() {
  return (await run('socat', ['-V'])).code === 0
}

/**
 * Resolve the WSL interface IPv4 that Windows reaches (eth0 in NAT mode).
 * Falls back to the first non-internal IPv4 interface when eth0 is absent.
 * @returns { iface, address } or undefined.
 */
export function wslIPv4() {
  const ifaces = networkInterfaces()
  const preferred = ['eth0', 'eth1']
  for (const name of preferred) {
    const v4 = (ifaces[name] ?? []).find((i) => i.family === 'IPv4' && !i.internal)
    if (v4) return { iface: name, address: v4.address }
  }
  for (const [name, list] of Object.entries(ifaces)) {
    const v4 = list.find((i) => i.family === 'IPv4' && !i.internal)
    if (v4) return { iface: name, address: v4.address }
  }
  return undefined
}

/** Extract global unicast IPv6 addresses (2000::/3) from command output. */
function extractGlobalIPv6(text) {
  const out = []
  const seen = new Set()
  for (const token of text.split(/[\s,;]+/u)) {
    const t = token.trim()
    if (!/^[0-9a-fA-F:]+$/u.test(t)) continue
    const colons = (t.match(/:/gu) ?? []).length
    if (colons < 2) continue
    const a = t.toLowerCase()
    if (a.startsWith('fe80') || a === '::1' || a.startsWith('::')) continue
    // Global unicast: 2000::/3 → first hextet begins with 2 or 3.
    if (!/^[23]/u.test(a)) continue
    if (!seen.has(a)) {
      seen.add(a)
      out.push(a)
    }
  }
  return out
}

/**
 * Ask Windows for its global IPv6 addresses. Primary source is
 * `netsh.exe interface ipv6 show addresses` (authoritative, IPv6-only);
 * `ipconfig.exe` is the fallback.
 * @returns array of global IPv6 addresses (possibly empty).
 */
export async function windowsGlobalIPv6() {
  for (const [cmd, args] of [
    ['netsh.exe', ['interface', 'ipv6', 'show', 'addresses']],
    ['ipconfig.exe', []],
  ]) {
    const { stdout } = await run(cmd, args)
    const found = extractGlobalIPv6(stdout)
    if (found.length > 0) return found
  }
  return []
}

/** Strip one trailing parenthesized suffix, e.g. `(首选)` / `(Preferred)`. */
function stripParenSuffix(token) {
  return token.replace(/[(（][^)）]*[)）]$/u, '')
}

/** One exact IPv4 match inside an arbitrary token (suffix-tolerant). */
function ipv4InToken(token) {
  const t = stripParenSuffix(token.trim())
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/u.test(t)) return undefined
  const octets = t.split('.').map(Number)
  if (octets.some((n) => n > 255)) return undefined
  // Network and broadcast host addresses never name a host.
  if (octets[3] === 0 || octets[3] === 255) return undefined
  return t
}

/** Rank one private IPv4 for LAN preference (home LANs first). */
function lanRank(a) {
  const [b, c] = a.split('.').map(Number)
  if (b === 192 && c === 168) return 0 // 192.168.x — the common home LAN
  if (b === 10) return 1              // 10.x
  if (b === 172 && c >= 16 && c <= 31) return 2 // 172.16-31 (WSL vEthernet lives here)
  return 3                            // anything else private/APIPA
}

/** Extract private IPv4 addresses, most-likely-LAN first, deduped. */
function extractLANIPv4(text) {
  const out = []
  const seen = new Set()
  for (const token of text.split(/[\s,;]+/u)) {
    const a = ipv4InToken(token)
    if (a === undefined) continue
    const octets = a.split('.').map(Number)
    const isPrivate =
      (octets[0] === 10) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168)
    if (!isPrivate) continue
    if (!seen.has(a)) {
      seen.add(a)
      out.push(a)
    }
  }
  out.sort((x, y) => lanRank(x) - lanRank(y))
  return out
}

/**
 * Ask Windows for its private (LAN) IPv4 addresses. Primary source is
 * `netsh.exe interface ipv4 show addresses`; `ipconfig.exe` is the fallback.
 * 192.168.x and 10.x rank before 172.16-31.x because the WSL vEthernet
 * adapter also lives in the 172.16-31 block.
 * @returns array of private IPv4 addresses (possibly empty).
 */
export async function windowsIPv4() {
  for (const [cmd, args] of [
    ['netsh.exe', ['interface', 'ipv4', 'show', 'addresses']],
    ['ipconfig.exe', []],
  ]) {
    const { stdout } = await run(cmd, args)
    const found = extractLANIPv4(stdout)
    if (found.length > 0) return found
  }
  return []
}

/**
 * Mode-aware Windows bind-address detection.
 * @param mode - 'ipv6' (global IPv6, v6tov4) or 'ipv4' (LAN IPv4, v4tov4).
 */
export function windowsAddresses(mode) {
  return mode === 'ipv4' ? windowsIPv4() : windowsGlobalIPv6()
}

/** The netsh portproxy rule type for a mode. */
export function proxyRuleType(mode) {
  return mode === 'ipv4' ? 'v4tov4' : 'v6tov4'
}

/** Human URL authority for the upstream (brackets for IPv6, plain for IPv4). */
export function upstreamUrl(address, mode, relayPort) {
  return mode === 'ipv4'
    ? `http://${address}:${relayPort}`
    : `http://[${address}]:${relayPort}`
}

// ── socat relay ──────────────────────────────────────────────────────────────

/**
 * Start the loopback relay as a detached process so it survives the DSH web
 * process: `socat TCP-LISTEN:<relayPort>,reuseaddr,fork TCP4:127.0.0.1:<webPort>`.
 * @returns the spawned pid.
 */
export function socatStart(relayPort, webPort) {
  // Defense in depth: a relay forwarding to its own listen port loops
  // forever, forking one process per connection (a process storm).
  if (relayPort === webPort) {
    throw new Error(`refusing to start a self-forwarding relay (${relayPort} → ${relayPort})`)
  }
  const child = spawn('socat', [
    `TCP-LISTEN:${relayPort},reuseaddr,fork`,
    `TCP4:127.0.0.1:${webPort}`,
  ], { detached: true, stdio: 'ignore' })
  // Swallow a spawn-time failure (e.g. ENOENT in a check/spawn race): the
  // caller verifies liveness with verifyRelay() instead.
  child.on('error', () => {})
  child.unref()
  return child.pid
}

/**
 * Stop any socat relay listening on `relayPort`. The pattern is anchored to
 * the port boundary (`,` or end of line), so `3082` never matches `30825`.
 */
export async function socatStop(relayPort) {
  await run('pkill', ['-f', `TCP-LISTEN:${relayPort}(,|$)`])
}

/** Parse one `ss -tln` line and return the local port number it names. */
function localPortOfLine(line) {
  if (!line.includes('LISTEN')) return undefined
  const fields = line.trim().split(/\s+/u)
  const local = fields[3] // e.g. 0.0.0.0:3082, [::]:3082, 127.0.0.1:3081
  if (!local) return undefined
  const idx = local.lastIndexOf(':')
  if (idx === -1) return undefined
  return local.slice(idx + 1)
}

/**
 * True when something is listening on exactly `relayPort` (IPv4 or IPv6).
 * Exact column comparison — `3082` never matches `30825`.
 */
export async function relayListening(relayPort) {
  const { stdout } = await run('ss', ['-tln'])
  const port = String(relayPort)
  return stdout.split(/\r?\n/u).some((line) => localPortOfLine(line) === port)
}

/** True when a pid exists and is killable (signal 0 probe). */
export function processAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** Resolve after `ms` milliseconds. */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Verify a just-spawned relay: wait for `relayPort` to start listening, then
 * confirm the spawned pid is still alive. `{ listening: true, alive: true }`
 * means the relay is up; `listening` without `alive` means something else
 * grabbed the port while our socat died.
 */
export async function verifyRelay(relayPort, pid, options = {}) {
  const timeoutMs = options.timeoutMs ?? 2000
  const intervalMs = options.intervalMs ?? 250
  const deadline = Date.now() + timeoutMs
  let listening = false
  while (Date.now() < deadline) {
    listening = await relayListening(relayPort)
    if (listening) break
    await sleep(intervalMs)
  }
  await sleep(150) // give an immediate failure time to surface as a dead pid
  return { listening, alive: processAlive(pid) }
}

// ── Windows portproxy ────────────────────────────────────────────────────────

export async function portproxyList() {
  const { stdout } = await run('netsh.exe', ['interface', 'portproxy', 'show', 'all'])
  return stdout
}

/**
 * True when a netsh portproxy table line names `relayPort` as one of its
 * port columns. Exact field comparison — `3082` never matches `30825`.
 */
export function portproxyLineHasPort(line, relayPort) {
  return line.trim().split(/\s+/u).includes(String(relayPort))
}

/**
 * Upsert a portproxy rule.
 *
 * netsh keys a rule by (listenaddress, listenport): adding over an existing
 * key fails with "object already exists" even when the connect side must
 * change — the exact case after a WSL restart, when eth0 gets a new IP and
 * the stale rule still points at the old one. On an add failure, delete the
 * existing key first and re-add; the returned result carries
 * `replaced: true` when that retry succeeded.
 */
export async function portproxyAdd(relayPort, listenAddr, wslIP, mode = 'ipv6') {
  const args = [
    'interface', 'portproxy', 'add', proxyRuleType(mode),
    `listenport=${relayPort}`,
    `listenaddress=${listenAddr}`,
    `connectport=${relayPort}`,
    `connectaddress=${wslIP}`,
  ]
  const first = await run('netsh.exe', args)
  if (first.code === 0) return first
  await portproxyDelete(relayPort, listenAddr, mode)
  const second = await run('netsh.exe', args)
  second.replaced = second.code === 0
  return second
}

export async function portproxyDelete(relayPort, listenAddr, mode = 'ipv6') {
  return run('netsh.exe', [
    'interface', 'portproxy', 'delete', proxyRuleType(mode),
    `listenport=${relayPort}`,
    `listenaddress=${listenAddr}`,
  ])
}

// ── Windows firewall ─────────────────────────────────────────────────────────

/**
 * Idempotent upsert of the allow rule.
 *
 * netsh keys firewall rules by an internal GUID, not by name: `add` over an
 * existing name does NOT error — it silently appends a duplicate rule on
 * every run, so repeated `/wan up` calls accumulate rules with stale ports.
 * Remove every rule carrying our name first (`delete rule name=…` removes
 * ALL matches, verified empirically), then add exactly one rule for the
 * current port. `replaced: true` reports that an existing rule was replaced.
 */
export async function firewallAdd(relayPort) {
  const existed = await firewallExists()
  await firewallDelete()
  const result = await run('netsh.exe', [
    'advfirewall', 'firewall', 'add', 'rule',
    `name=${FIREWALL_RULE_NAME}`,
    'dir=in', 'action=allow', 'protocol=TCP',
    `localport=${relayPort}`,
  ])
  if (existed) result.replaced = result.code === 0
  return result
}

export async function firewallDelete() {
  return run('netsh.exe', [
    'advfirewall', 'firewall', 'delete', 'rule',
    `name=${FIREWALL_RULE_NAME}`,
  ])
}

export async function firewallExists() {
  const { stdout } = await run('netsh.exe', [
    'advfirewall', 'firewall', 'show', 'rule',
    `name=${FIREWALL_RULE_NAME}`,
  ])
  return stdout.includes(FIREWALL_RULE_NAME)
}

// ── trusted-host fence (cordis.patch.yml) ────────────────────────────────────

/** Resolve the profile's user patch layer path, given the profile name. */
export function userPatchPath(profileName) {
  return dshHomePath('profiles', profileName, 'cordis.patch.yml')
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

const MANAGED_RE = new RegExp(
  `${escapeRegExp(MANAGED_START)}[\\s\\S]*?${escapeRegExp(MANAGED_END)}\\r?\\n?`,
  'gu',
)

/** Strip a previously-written managed block. */
function stripManaged(text) {
  return text.replace(MANAGED_RE, '')
}

/** Ensure a bare `[]` placeholder exists when nothing else does. */
function restorePlaceholder(text) {
  const withoutComments = text.replace(/^[ \t]*#.*$/gmu, '').trim()
  if (withoutComments !== '') return text
  const revived = text.replace(/^[ \t]*#[ \t]*\[[ \t]*\][ \t]*(?:\r?\n|$)/mu, '[]\n')
  if (revived !== text) return revived
  return text === '' || text.endsWith('\n') ? `${text}[]\n` : `${text}\n[]\n`
}

/** Comment out a bare `[]` placeholder before appending the first entry. */
function commentPlaceholder(text) {
  return text.replace(/^[ \t]*\[[ \t]*\][ \t]*(?:#.*)?(?:\r?\n|$)/mu, '# []\n')
}

/** Reject authorities that would break the trusted-host fence entry. */
function isValidAuthority(domain) {
  const d = domain.trim()
  if (d.length === 0) return false
  // Bare authority: no scheme, path, userinfo, whitespace, or YAML/JS quotes.
  if (/[\s/@#"'\\]|\/\//u.test(d)) return false
  if (d.startsWith('http:') || d.startsWith('https:')) return false
  return true
}

/**
 * Idempotently write the `connection` trusted-host override for one domain.
 *
 * The `!!js` tag is scalar-only in DSH's YAML dialect: a flow sequence after
 * `!!js` fails to parse ("unknown tag"), so the expression is written as one
 * double-quoted scalar string the loader evals into an array.
 *
 * @param patchPath - absolute path to the profile's cordis.patch.yml.
 * @param domain - bare authority (`host` or `host:port`); empty removes the block.
 * @returns { ok, domain, reason }.
 */
export function writeTrustedHost(patchPath, domain) {
  let text = ''
  try {
    text = readFileSync(patchPath, 'utf8')
  } catch {
    /* created below */
  }
  text = stripManaged(text)

  if (!domain || domain.trim() === '') {
    writeFileSync(patchPath, restorePlaceholder(text))
    return { ok: true, domain: null, reason: null }
  }

  if (!isValidAuthority(domain)) {
    return {
      ok: false,
      domain: null,
      reason: `domain must be a bare authority (host or host:port), got ${JSON.stringify(domain)}`,
    }
  }

  const d = domain.trim()
  // Expression embedded in a YAML double-quoted scalar: quotes/backslashes are
  // rejected by isValidAuthority, single quotes are plain inside the JS string.
  const expr = `['${d}', ...ctx.webRuntime.trustedHosts]`
  const block = [
    MANAGED_START,
    '- id: connection',
    '  config:',
    `    trustedHosts: !!js "${expr}"`,
    MANAGED_END,
    '',
  ].join('\n')

  let next = commentPlaceholder(text)
  next = next.endsWith('\n') ? next : `${next}\n`
  next = `${next}\n${block}`
  writeFileSync(patchPath, next)
  return { ok: true, domain: d, reason: null }
}

/** Read the domain currently written by this plugin (or undefined). */
export function readTrustedHost(patchPath) {
  let text = ''
  try {
    text = readFileSync(patchPath, 'utf8')
  } catch {
    return undefined
  }
  const line = text.split(/\r?\n/u).find(
    (l) => l.includes('trustedHosts: !!js') && l.includes('ctx.webRuntime.trustedHosts'),
  )
  if (line === undefined) return undefined
  // Unquote the YAML scalar: double-quoted as written, or single-quoted with
  // doubled quotes after a js-yaml round-trip.
  let scalar = line.split('!!js', 2)[1].trim()
  if (scalar.startsWith('"')) scalar = scalar.slice(1, -1)
  else if (scalar.startsWith("'")) scalar = scalar.slice(1, -1).replace(/''/gu, "'")
  const match = /^\['([^']*)', \.\.\.ctx\.webRuntime\.trustedHosts\]$/u.exec(scalar)
  return match?.[1] || undefined
}

// ── summary helpers ──────────────────────────────────────────────────────────

/** Line-oriented boolean for a readable report. */
export function yn(value) {
  return value ? 'yes' : 'no'
}

/** Build the profile path the plugin edits, for display purposes only. */
export function profileDir(profileName) {
  return dshHomePath('profiles', profileName)
}

export { join }
