import type { Context } from '@deepseek-ai/cordis'

/**
 * dsh-wsl-expose — expose the DSH Web GUI over IPv6 or IPv4 from WSL2 through
 * a reverse proxy (Lucky). Registers the `/wan` slash command.
 */

export declare const name: 'dsh-wsl-expose'
export declare const inject: ['commands']
/** Settings namespace the UI renders as a configurable form card. */
export declare const SETTINGS_NAMESPACE: string

export interface Config {
  /** Which Windows side the portproxy listens on: 'ipv6' (v6tov4) or 'ipv4' (v4tov4). */
  mode?: 'ipv6' | 'ipv4'
  /** TCP port the socat relay listens on (Lucky points here). */
  relayPort?: number
  /** Fallback web port when the live webserver port cannot be resolved. */
  webPort?: number
  /** Default public authority for `/wan up` when none is passed. */
  domain?: string
  /** Override the Windows listen address the portproxy binds (auto-detected by mode). */
  windowsAddress?: string
}

export declare const Config: import('@deepseek-ai/schemastery').default

export declare function apply(ctx: Context, config?: Partial<Config>): void

// ── engine re-exports (for advanced/tests use) ──────────────────────────────

export interface RunResult {
  code: number
  stdout: string
  stderr: string
  error?: unknown
  /** portproxyAdd / firewallAdd only: the add failed, stale rule(s) were removed, and the re-add succeeded. */
  replaced?: boolean
}

export declare function run(cmd: string, args: string[], options?: { timeout?: number; exec?: object }): Promise<RunResult>
export declare function isWsl(): boolean
export declare function hasSocat(): Promise<boolean>
export declare function wslIPv4(): { iface: string; address: string } | undefined
export declare function windowsGlobalIPv6(): Promise<string[]>
export declare function windowsIPv4(): Promise<string[]>
export declare function windowsAddresses(mode: 'ipv6' | 'ipv4'): Promise<string[]>
export declare function proxyRuleType(mode: 'ipv6' | 'ipv4'): 'v6tov4' | 'v4tov4'
export declare function upstreamUrl(address: string, mode: 'ipv6' | 'ipv4', relayPort: number): string
export declare function socatStart(relayPort: number, webPort: number): number | undefined
export declare function socatStop(relayPort: number): Promise<void>
export declare function relayListening(relayPort: number): Promise<boolean>
export declare function processAlive(pid: number): boolean
export declare const sleep: (ms: number) => Promise<void>
export declare function verifyRelay(relayPort: number, pid: number, options?: { timeoutMs?: number; intervalMs?: number }): Promise<{ listening: boolean; alive: boolean }>
export declare function portproxyList(): Promise<string>
export declare function portproxyLineHasPort(line: string, relayPort: number): boolean
export declare function portproxyAdd(relayPort: number, listenAddr: string, wslIP: string, mode?: 'ipv6' | 'ipv4'): Promise<RunResult>
export declare function portproxyDelete(relayPort: number, listenAddr: string, mode?: 'ipv6' | 'ipv4'): Promise<RunResult>
export declare function firewallAdd(relayPort: number): Promise<RunResult>
export declare function firewallDelete(): Promise<RunResult>
export declare function firewallExists(): Promise<boolean>
export declare function userPatchPath(profileName: string): string
export declare function writeTrustedHost(patchPath: string, domain: string): { ok: boolean; domain: string | null; reason: string | null }
export declare function readTrustedHost(patchPath: string): string | undefined
export declare const FIREWALL_RULE_NAME: string
export declare const MANAGED_START: string
export declare const MANAGED_END: string
