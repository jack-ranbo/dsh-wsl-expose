/**
 * dsh-wsl-expose client — Settings → Plugins card editing the `wsl-expose`
 * settings namespace (domain, relay port, web port, trusted-host fence).
 *
 * Built by scripts/build-client.mjs into the __ModuleLoader__ factory bundle
 * at client/client.js; the only externals are the loader module table's
 * react entries. Self-contained on purpose: the client purity gate forbids
 * cross-plugin runtime imports, so the card form and markup live here.
 */
import { createElement as h, Fragment, useState } from 'react'
import { en, zh } from './locales.ts'

const NS = 'wsl-expose'

export const name = 'dsh-wsl-expose'
/** settingsScope arrives through a NESTED inject so hosts without the plugin
 * configuration page (older cores) still mount this bundle for its nothing
 * else — mirroring dshmarket's card wiring. */
export const inject = ['slots', 'locale']

// ── field specs ──────────────────────────────────────────────────────────────

function textField(field) {
  return {
    field,
    kind: 'text',
    format: (value) => (typeof value === 'string' ? value : ''),
    parse: (text) => {
      const trimmed = text.trim()
      return trimmed === '' ? { kind: 'clear' } : { kind: 'set', value: trimmed }
    },
  }
}

function numberField(field) {
  return {
    field,
    kind: 'number',
    format: (value) => (typeof value === 'number' ? String(value) : ''),
    parse: (text) => {
      const trimmed = text.trim()
      if (trimmed === '') return { kind: 'clear' }
      const parsed = Number(trimmed)
      return Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535
        ? { kind: 'set', value: parsed }
        : undefined
    },
  }
}

function boolField(field, defaultValue) {
  return { field, kind: 'bool', defaultValue }
}

// ── staged card form (mirrors the official card-form contract) ──────────────

class CardForm {
  constructor(scope, specs) {
    this.scope = scope
    this.specs = new Map(specs.map((spec) => [spec.field, spec]))
    this.staged = new Map()
    this.listeners = new Set()
    this.saving = false
    this.failed = false
    scope.subscribe(() => this.publish())
  }

  bind(project) {
    const store = {
      state: project(),
      listeners: new Set(),
      getSnapshot: () => store.state,
      subscribe: (fn) => {
        store.listeners.add(fn)
        return () => store.listeners.delete(fn)
      },
      set: (next) => {
        store.state = next
        for (const fn of [...store.listeners]) fn()
      },
    }
    this.listeners.add(() => store.set(project()))
    return store
  }

  snapshot() {
    return this.scope.getSnapshot()
  }

  shell() {
    const snapshot = this.snapshot()
    const plan = this.plan()
    return {
      available: snapshot.status === 'ready',
      writable: snapshot.writable,
      dirty: plan.length > 0,
      invalid: plan.some((item) => item.run === undefined),
      saving: this.saving,
      failed: this.failed,
    }
  }

  field(field) {
    const spec = this.spec(field)
    const staged = this.staged.get(field)
    if (staged === undefined) {
      return {
        text: spec.format(this.sectionValue(field)),
        overridden: this.stored(field),
        invalid: false,
      }
    }
    if (staged.clear) {
      return { text: spec.format(this.baseValue(field)), overridden: false, invalid: false }
    }
    const write = spec.parse(staged.text)
    return {
      text: staged.text,
      overridden: write?.kind === 'set',
      invalid: write === undefined,
    }
  }

  bool(field) {
    const spec = this.spec(field)
    const staged = this.staged.get(field)
    let checked
    if (staged === undefined) checked = this.sectionValue(field) ?? spec.defaultValue
    else if (staged.clear) checked = this.baseValue(field) ?? spec.defaultValue
    else checked = staged.value
    return { checked: Boolean(checked), overridden: this.stored(field) }
  }

  actions() {
    return {
      edit: (field, text) => this.stage(field, { text, clear: false }),
      toggle: (field) => {
        const spec = this.spec(field)
        const current = this.staged.get(field)?.value ?? this.sectionValue(field) ?? spec.defaultValue
        this.stage(field, { value: !Boolean(current), clear: false })
      },
      resetField: (field) => this.stage(field, { clear: true }),
      save: () => this.save(),
      discard: () => {
        this.staged.clear()
        this.failed = false
        this.publish()
      },
    }
  }

  async save() {
    const plan = this.plan()
    const writes = plan.flatMap((item) => (item.run === undefined ? [] : [item.run]))
    if (plan.length === 0 || this.saving || writes.length !== plan.length) return
    this.saving = true
    this.failed = false
    this.publish()
    let landed = true
    for (const write of writes) landed = (await write()) && landed
    if (landed) this.staged.clear()
    this.saving = false
    this.failed = !landed
    this.publish()
  }

  plan() {
    const plan = []
    for (const [field, staged] of this.staged) {
      const spec = this.spec(field)
      if (staged.clear) {
        if (this.stored(field)) plan.push({ field, run: () => this.clear(field) })
        continue
      }
      if (spec.kind === 'bool') {
        const current = this.sectionValue(field) ?? spec.defaultValue
        if (staged.value !== Boolean(current)) {
          plan.push({ field, run: () => this.store(field, staged.value) })
        }
        continue
      }
      if (staged.text === spec.format(this.sectionValue(field))) continue
      const write = spec.parse(staged.text)
      if (write === undefined) plan.push({ field, run: undefined })
      else if (write.kind === 'clear') plan.push({ field, run: () => this.clear(field) })
      else plan.push({ field, run: () => this.store(field, write.value) })
    }
    return plan
  }

  async clear(field) {
    await this.scope.unset(field)
    return !this.stored(field)
  }

  async store(field, value) {
    await this.scope.set(field, value)
    return this.userLayer()?.[field] === value
  }

  stage(field, edit) {
    this.staged.set(field, edit)
    this.failed = false
    this.publish()
  }

  spec(field) {
    const spec = this.specs.get(field)
    if (spec === undefined) throw new Error(`plugin card has no field ${field}`)
    return spec
  }

  sectionValue(field) {
    return this.snapshot().value?.[field]
  }

  baseValue(field) {
    return this.snapshot().base?.[field]
  }

  userLayer() {
    return this.snapshot().user
  }

  stored(field) {
    const user = this.userLayer()
    return user !== undefined && Object.hasOwn(user, field)
  }

  publish() {
    for (const listener of [...this.listeners]) listener()
  }
}

// ── card styles (injected once, keyed like official client bundles) ─────────

const css = '.wanx_card{list-style:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;transition:border-color .16s,background .16s}.wanx_card:hover{border-color:var(--dsw-alias-label-dimmed)}.wanx_open{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}.wanx_header{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}.wanx_header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}.wanx_headText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}.wanx_name{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}.wanx_desc{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.5}.wanx_chevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}.wanx_chevronOpen{transform:rotate(180deg)}.wanx_body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}.wanx_field{padding-top:12px;display:block}.wanx_head{display:flex;align-items:center;gap:8px}.wanx_label{color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px}.wanx_badges{margin-left:auto;display:flex;align-items:center;gap:6px}.wanx_badge{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500}.wanx_reset{appearance:none;border:0;background:0 0;color:var(--dsw-alias-label-tertiary);font-size:11px;cursor:pointer;padding:0;text-decoration:underline}.wanx_reset:disabled{opacity:.4;cursor:default}.wanx_input{box-sizing:border-box;width:100%;margin-top:6px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;padding:6px 10px}.wanx_input:focus{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-1px}.wanx_input:disabled{opacity:.5}.wanx_inputInvalid{border-color:var(--dsw-alias-label-error)}.wanx_hint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5;margin:4px 0 0}.wanx_invalid{color:var(--dsw-alias-label-error);font-size:12px;line-height:1.5;margin:4px 0 0}.wanx_checkRow{display:flex;gap:8px;align-items:flex-start;padding-top:12px}.wanx_check{width:16px;height:16px;margin-top:2px;flex:none}.wanx_footer{border-top:1px solid var(--dsw-alias-border-l2);justify-content:flex-end;align-items:center;gap:8px;padding:12px 0 4px;display:flex}.wanx_failed{min-width:0;color:var(--dsw-alias-label-error);flex:1;margin:0;font-size:12px;line-height:1.5}.wanx_discard,.wanx_save{appearance:none;font:inherit;cursor:pointer;border:1px solid #0000;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5}.wanx_discard{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0}.wanx_discard:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}.wanx_save{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}.wanx_discard:disabled,.wanx_save:disabled{opacity:.4;cursor:default}.wanx_readOnly{color:var(--dsw-alias-label-tertiary);margin:12px 0 0;font-size:12px;line-height:1.5}'

const TAG_ID = 'dsh-wsl-expose/card.css'

const styles = {
  card: 'wanx_card',
  open: 'wanx_open',
  header: 'wanx_header',
  headText: 'wanx_headText',
  name: 'wanx_name',
  desc: 'wanx_desc',
  chevron: 'wanx_chevron',
  chevronOpen: 'wanx_chevronOpen',
  body: 'wanx_body',
  field: 'wanx_field',
  head: 'wanx_head',
  label: 'wanx_label',
  badges: 'wanx_badges',
  badge: 'wanx_badge',
  reset: 'wanx_reset',
  input: 'wanx_input',
  inputInvalid: 'wanx_inputInvalid',
  hint: 'wanx_hint',
  invalid: 'wanx_invalid',
  checkRow: 'wanx_checkRow',
  check: 'wanx_check',
  footer: 'wanx_footer',
  failed: 'wanx_failed',
  discard: 'wanx_discard',
  save: 'wanx_save',
  readOnly: 'wanx_readOnly',
}

function injectStylesheet() {
  if (typeof document === 'undefined') return
  if (document.querySelector(`style[data-plugin-css=${JSON.stringify(TAG_ID)}]`) !== null) return
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-wsl-expose'
  tag.dataset.pluginCss = TAG_ID
  tag.textContent = css
  document.head.appendChild(tag)
}

// ── field controls ───────────────────────────────────────────────────────────

function TextField(props) {
  const { t } = props
  return h('div', { className: styles.field },
    h('div', { className: styles.head },
      h('label', { className: styles.label, htmlFor: props.id }, props.label),
      props.overridden ? h('span', { className: styles.badges },
        h('span', { className: styles.badge }, props.overriddenLabel),
        h('button', { type: 'button', className: styles.reset, disabled: props.disabled, onClick: props.onReset }, props.resetLabel)) : null),
    h('input', {
      id: props.id,
      className: props.invalid ? styles.inputInvalid : styles.input,
      type: 'text',
      ...(props.numeric === true ? { inputMode: 'numeric' } : {}),
      ...(props.invalid ? { 'aria-invalid': true } : {}),
      value: props.text,
      placeholder: props.placeholder ?? '',
      disabled: props.disabled,
      onChange: (event) => props.onEdit(event.target.value),
    }),
    h('p', { className: props.invalid ? styles.invalid : styles.hint }, props.invalid ? props.invalidLabel : props.hint))
}

function CheckField(props) {
  const { t } = props
  return h('div', { className: styles.checkRow },
    h('input', {
      id: props.id,
      className: styles.check,
      type: 'checkbox',
      checked: props.checked,
      disabled: props.disabled,
      onChange: () => props.onToggle(),
    }),
    h('div', null,
      h('div', { className: styles.head },
        h('label', { className: styles.label, htmlFor: props.id }, props.label),
        props.overridden ? h('span', { className: styles.badges },
          h('span', { className: styles.badge }, props.overriddenLabel),
          h('button', { type: 'button', className: styles.reset, disabled: props.disabled, onClick: props.onReset }, props.resetLabel)) : null),
      h('p', { className: styles.hint }, props.hint)))
}

// ── the card ─────────────────────────────────────────────────────────────────

function WslExposeCard(props) {
  const { t } = props
  const state = props.useWslExposeCard((snapshot) => snapshot)
  const [open, setOpen] = useState(false)
  if (!state.available) return null
  const disabled = !state.writable
  const blocked = !state.dirty || state.invalid || state.saving
  return h('li', { className: open ? `${styles.card} ${styles.open}` : styles.card },
    h('button', {
      type: 'button',
      className: styles.header,
      'aria-expanded': open,
      'aria-label': `${t(open ? 'collapse' : 'expand')}: ${t('cardTitle')}`,
      onClick: () => setOpen(!open),
    },
      h('span', { className: styles.headText },
        h('span', { className: styles.name }, t('cardTitle')),
        h('span', { className: styles.desc }, t('cardDesc'))),
      state.dirty ? h('span', { className: styles.badge }, t('unsaved')) : null,
      h('span', { className: open ? `${styles.chevron} ${styles.chevronOpen}` : styles.chevron }, '▾')),
    open ? h('div', { className: styles.body },
      !state.writable ? h('p', { className: styles.readOnly, role: 'status' }, t('readOnly')) : null,
      h(TextField, {
        t, id: 'plugin-config-wan-domain', label: t('domainLabel'), hint: t('domainHint'),
        overriddenLabel: t('overridden'), resetLabel: t('reset'), invalidLabel: t('invalidDomain'),
        disabled, ...state.domain,
        onEdit: (text) => props.edit('domain', text),
        onReset: () => props.resetField('domain'),
      }),
      h(TextField, {
        t, id: 'plugin-config-wan-relay', label: t('relayLabel'), hint: t('relayHint'), numeric: true,
        overriddenLabel: t('overridden'), resetLabel: t('reset'), invalidLabel: t('invalidNumber'),
        disabled, ...state.relayPort,
        onEdit: (text) => props.edit('relayPort', text),
        onReset: () => props.resetField('relayPort'),
      }),
      h(TextField, {
        t, id: 'plugin-config-wan-web', label: t('webLabel'), hint: t('webHint'), numeric: true,
        overriddenLabel: t('overridden'), resetLabel: t('reset'), invalidLabel: t('invalidNumber'),
        disabled, ...state.webPort,
        onEdit: (text) => props.edit('webPort', text),
        onReset: () => props.resetField('webPort'),
      }),
      h(CheckField, {
        t, id: 'plugin-config-wan-fence', label: t('fenceLabel'), hint: t('fenceHint'),
        overriddenLabel: t('overridden'), resetLabel: t('reset'),
        disabled, ...state.fence,
        onToggle: () => props.toggle('fence'),
        onReset: () => props.resetField('fence'),
      }),
      h('div', { className: styles.footer },
        state.failed ? h('p', { className: styles.failed, role: 'status' }, t('saveFailed')) : null,
        h('button', { type: 'button', className: styles.discard, disabled: !state.dirty || state.saving, onClick: props.discard }, t('discard')),
        h('button', { type: 'button', className: styles.save, disabled: blocked, onClick: props.save }, t(state.saving ? 'saving' : 'save'))))
      : null)
}

// ── plugin entry ─────────────────────────────────────────────────────────────

export function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-wsl-expose: dictionaries')
  injectStylesheet()

  // Nested on purpose: naming settingsScope at the module level would keep
  // the whole bundle unmounted on hosts without the plugin configuration
  // page; nested, the card simply never appears there.
  ctx.inject(['settingsScope'], (scoped) => {
    const form = new CardForm(
      scoped.settingsScope.bind({ namespace: NS }),
      [textField('domain'), numberField('relayPort'), numberField('webPort'), boolField('fence', false)],
    )
    const projection = () => ({
      ...form.shell(),
      domain: form.field('domain'),
      relayPort: form.field('relayPort'),
      webPort: form.field('webPort'),
      fence: form.bool('fence'),
    })
    // The component is registered DIRECTLY (not behind a render closure):
    // the slot renderer passes kit props (t, …) plus the bound inject face
    // (useWslExposeCard, edit, …) to the component itself. A closure here
    // would swallow those props — the renderer can only feed what it calls.
    scoped.slots.inject('settings.plugin.item', () => scoped.slots.register({
      name: 'settings.plugin.item',
      key: NS,
      locale: NS,
      inject: () => ({
        hooks: { wslExposeCard: form.bind(projection) },
        ...form.actions(),
      }),
    }, WslExposeCard))
  })
}
