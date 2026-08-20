window.__ModuleLoader__.load({ id: "dsh-wsl-expose", factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);
var import_react = require("react");

// src/client/locales.ts
var zh = {
  cardTitle: "dsh-wsl-expose",
  cardDesc: "\u516C\u7F51\u8BBF\u95EE\u914D\u7F6E\uFF1A\u57DF\u540D\u3001\u4E2D\u7EE7\u7AEF\u53E3\u4E0E\u8F6C\u53D1\u7AEF\u53E3\u3002\u8FD9\u91CC\u548C /wan set-* \u547D\u4EE4\u8BFB\u5199\u7684\u662F\u540C\u4E00\u4EFD\u6301\u4E45\u5316\u8BBE\u7F6E\u3002",
  domainLabel: "\u57DF\u540D",
  domainHint: "/wan up \u4F7F\u7528\u7684\u516C\u7F51\u57DF\u540D\uFF0C\u4F8B\u5982 dsh.smallmonkey.cn\u3002\u7559\u7A7A\u5219 /wan up \u9700\u8981\u624B\u52A8\u4F20\u57DF\u540D\u3002",
  relayLabel: "\u4E2D\u7EE7\u7AEF\u53E3\uFF08\u76D1\u542C\uFF09",
  relayHint: "socat \u7684\u76D1\u542C\u7AEF\u53E3\uFF0CLucky \u4E0A\u6E38\u6307\u5411\u8FD9\u91CC\uFF081-65535\uFF0C\u9ED8\u8BA4 3082\uFF09\u3002",
  webLabel: "\u8F6C\u53D1\u7AEF\u53E3\uFF08DSH\uFF09",
  webHint: "DSH web \u670D\u52A1\u5728 127.0.0.1 \u4E0A\u76D1\u542C\u7684\u7AEF\u53E3\uFF081-65535\uFF0C\u9ED8\u8BA4 3080\uFF09\u3002\u4E24\u4E2A\u7AEF\u53E3\u4E0D\u80FD\u76F8\u540C\u3002",
  fenceLabel: "\u5199\u5165 trusted-host \u767D\u540D\u5355",
  fenceHint: "/wan up \u662F\u5426\u540C\u65F6\u628A\u57DF\u540D\u5199\u5165 /api \u4FE1\u4EFB\u56F4\u680F\u3002\u9ED8\u8BA4\u5173\u95ED\u2014\u2014\u8BE5\u56F4\u680F\u4E0D\u662F\u9274\u6743\uFF0C\u5F00\u542F\u524D\u5FC5\u987B\u5728\u53CD\u4EE3\u5C42\u52A0\u771F\u9274\u6743\u3002",
  overridden: "\u5DF2\u8986\u76D6",
  reset: "\u91CD\u7F6E",
  invalidNumber: "\u5FC5\u987B\u662F 1-65535 \u7684\u6574\u6570",
  invalidDomain: "\u57DF\u540D\u4E0D\u80FD\u4E3A\u7A7A",
  unsaved: "\u672A\u4FDD\u5B58",
  save: "\u4FDD\u5B58",
  saving: "\u4FDD\u5B58\u4E2D\u2026",
  saveFailed: "\u4FDD\u5B58\u5931\u8D25\uFF1A\u503C\u88AB\u62D2\u7EDD\uFF0C\u8BF7\u4FEE\u6539\u540E\u91CD\u8BD5\u3002",
  discard: "\u653E\u5F03\u4FEE\u6539",
  readOnly: "\u5F53\u524D\u73AF\u5883\u4E0D\u53EF\u5199\uFF08\u53EA\u8BFB\uFF09\u3002",
  expand: "\u5C55\u5F00",
  collapse: "\u6536\u8D77"
};
var en = {
  cardTitle: "dsh-wsl-expose",
  cardDesc: "Public access settings: domain, relay port and forward port. This card and the /wan set-* commands read and write the same persisted values.",
  domainLabel: "Domain",
  domainHint: "The public domain /wan up uses, e.g. dsh.smallmonkey.cn. Leave empty to pass it on the command line.",
  relayLabel: "Relay port (listen)",
  relayHint: "The socat listen port; the Lucky upstream points here (1-65535, default 3082).",
  webLabel: "Forward port (DSH)",
  webHint: "The port the DSH web server listens on at 127.0.0.1 (1-65535, default 3080). The two ports must differ.",
  fenceLabel: "Write trusted-host fence",
  fenceHint: "Whether /wan up also writes the domain into the /api trust fence. OFF by default \u2014 the fence is not authentication; enable it only behind a proxy with real auth.",
  overridden: "overridden",
  reset: "reset",
  invalidNumber: "must be an integer between 1 and 65535",
  invalidDomain: "domain cannot be empty",
  unsaved: "unsaved",
  save: "Save",
  saving: "Saving\u2026",
  saveFailed: "Save failed: the value was rejected \u2014 fix it and retry.",
  discard: "Discard",
  readOnly: "This environment is read-only.",
  expand: "Expand",
  collapse: "Collapse"
};

// src/client/index.ts
var NS = "wsl-expose";
var name = "dsh-wsl-expose";
var inject = ["slots", "locale"];
function textField(field) {
  return {
    field,
    kind: "text",
    format: (value) => typeof value === "string" ? value : "",
    parse: (text) => {
      const trimmed = text.trim();
      return trimmed === "" ? { kind: "clear" } : { kind: "set", value: trimmed };
    }
  };
}
function numberField(field) {
  return {
    field,
    kind: "number",
    format: (value) => typeof value === "number" ? String(value) : "",
    parse: (text) => {
      const trimmed = text.trim();
      if (trimmed === "") return { kind: "clear" };
      const parsed = Number(trimmed);
      return Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535 ? { kind: "set", value: parsed } : void 0;
    }
  };
}
function boolField(field, defaultValue) {
  return { field, kind: "bool", defaultValue };
}
var CardForm = class {
  constructor(scope, specs) {
    this.scope = scope;
    this.specs = new Map(specs.map((spec) => [spec.field, spec]));
    this.staged = /* @__PURE__ */ new Map();
    this.listeners = /* @__PURE__ */ new Set();
    this.saving = false;
    this.failed = false;
    scope.subscribe(() => this.publish());
  }
  bind(project) {
    const store = {
      state: project(),
      listeners: /* @__PURE__ */ new Set(),
      getSnapshot: () => store.state,
      subscribe: (fn) => {
        store.listeners.add(fn);
        return () => store.listeners.delete(fn);
      },
      set: (next) => {
        store.state = next;
        for (const fn of [...store.listeners]) fn();
      }
    };
    this.listeners.add(() => store.set(project()));
    return store;
  }
  snapshot() {
    return this.scope.getSnapshot();
  }
  shell() {
    const snapshot = this.snapshot();
    const plan = this.plan();
    return {
      available: snapshot.status === "ready",
      writable: snapshot.writable,
      dirty: plan.length > 0,
      invalid: plan.some((item) => item.run === void 0),
      saving: this.saving,
      failed: this.failed
    };
  }
  field(field) {
    const spec = this.spec(field);
    const staged = this.staged.get(field);
    if (staged === void 0) {
      return {
        text: spec.format(this.sectionValue(field)),
        overridden: this.stored(field),
        invalid: false
      };
    }
    if (staged.clear) {
      return { text: spec.format(this.baseValue(field)), overridden: false, invalid: false };
    }
    const write = spec.parse(staged.text);
    return {
      text: staged.text,
      overridden: write?.kind === "set",
      invalid: write === void 0
    };
  }
  bool(field) {
    const spec = this.spec(field);
    const staged = this.staged.get(field);
    let checked;
    if (staged === void 0) checked = this.sectionValue(field) ?? spec.defaultValue;
    else if (staged.clear) checked = this.baseValue(field) ?? spec.defaultValue;
    else checked = staged.value;
    return { checked: Boolean(checked), overridden: this.stored(field) };
  }
  actions() {
    return {
      edit: (field, text) => this.stage(field, { text, clear: false }),
      toggle: (field) => {
        const spec = this.spec(field);
        const current = this.staged.get(field)?.value ?? this.sectionValue(field) ?? spec.defaultValue;
        this.stage(field, { value: !Boolean(current), clear: false });
      },
      resetField: (field) => this.stage(field, { clear: true }),
      save: () => this.save(),
      discard: () => {
        this.staged.clear();
        this.failed = false;
        this.publish();
      }
    };
  }
  async save() {
    const plan = this.plan();
    const writes = plan.flatMap((item) => item.run === void 0 ? [] : [item.run]);
    if (plan.length === 0 || this.saving || writes.length !== plan.length) return;
    this.saving = true;
    this.failed = false;
    this.publish();
    let landed = true;
    for (const write of writes) landed = await write() && landed;
    if (landed) this.staged.clear();
    this.saving = false;
    this.failed = !landed;
    this.publish();
  }
  plan() {
    const plan = [];
    for (const [field, staged] of this.staged) {
      const spec = this.spec(field);
      if (staged.clear) {
        if (this.stored(field)) plan.push({ field, run: () => this.clear(field) });
        continue;
      }
      if (spec.kind === "bool") {
        const current = this.sectionValue(field) ?? spec.defaultValue;
        if (staged.value !== Boolean(current)) {
          plan.push({ field, run: () => this.store(field, staged.value) });
        }
        continue;
      }
      if (staged.text === spec.format(this.sectionValue(field))) continue;
      const write = spec.parse(staged.text);
      if (write === void 0) plan.push({ field, run: void 0 });
      else if (write.kind === "clear") plan.push({ field, run: () => this.clear(field) });
      else plan.push({ field, run: () => this.store(field, write.value) });
    }
    return plan;
  }
  async clear(field) {
    await this.scope.unset(field);
    return !this.stored(field);
  }
  async store(field, value) {
    await this.scope.set(field, value);
    return this.userLayer()?.[field] === value;
  }
  stage(field, edit) {
    this.staged.set(field, edit);
    this.failed = false;
    this.publish();
  }
  spec(field) {
    const spec = this.specs.get(field);
    if (spec === void 0) throw new Error(`plugin card has no field ${field}`);
    return spec;
  }
  sectionValue(field) {
    return this.snapshot().value?.[field];
  }
  baseValue(field) {
    return this.snapshot().base?.[field];
  }
  userLayer() {
    return this.snapshot().user;
  }
  stored(field) {
    const user = this.userLayer();
    return user !== void 0 && Object.hasOwn(user, field);
  }
  publish() {
    for (const listener of [...this.listeners]) listener();
  }
};
var css = ".wanx_card{list-style:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;transition:border-color .16s,background .16s}.wanx_card:hover{border-color:var(--dsw-alias-label-dimmed)}.wanx_open{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}.wanx_header{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}.wanx_header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}.wanx_headText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}.wanx_name{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}.wanx_desc{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.5}.wanx_chevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}.wanx_chevronOpen{transform:rotate(180deg)}.wanx_body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}.wanx_field{padding-top:12px;display:block}.wanx_head{display:flex;align-items:center;gap:8px}.wanx_label{color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px}.wanx_badges{margin-left:auto;display:flex;align-items:center;gap:6px}.wanx_badge{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500}.wanx_reset{appearance:none;border:0;background:0 0;color:var(--dsw-alias-label-tertiary);font-size:11px;cursor:pointer;padding:0;text-decoration:underline}.wanx_reset:disabled{opacity:.4;cursor:default}.wanx_input{box-sizing:border-box;width:100%;margin-top:6px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;padding:6px 10px}.wanx_input:focus{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-1px}.wanx_input:disabled{opacity:.5}.wanx_inputInvalid{border-color:var(--dsw-alias-label-error)}.wanx_hint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5;margin:4px 0 0}.wanx_invalid{color:var(--dsw-alias-label-error);font-size:12px;line-height:1.5;margin:4px 0 0}.wanx_checkRow{display:flex;gap:8px;align-items:flex-start;padding-top:12px}.wanx_check{width:16px;height:16px;margin-top:2px;flex:none}.wanx_footer{border-top:1px solid var(--dsw-alias-border-l2);justify-content:flex-end;align-items:center;gap:8px;padding:12px 0 4px;display:flex}.wanx_failed{min-width:0;color:var(--dsw-alias-label-error);flex:1;margin:0;font-size:12px;line-height:1.5}.wanx_discard,.wanx_save{appearance:none;font:inherit;cursor:pointer;border:1px solid #0000;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5}.wanx_discard{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0}.wanx_discard:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}.wanx_save{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}.wanx_discard:disabled,.wanx_save:disabled{opacity:.4;cursor:default}.wanx_readOnly{color:var(--dsw-alias-label-tertiary);margin:12px 0 0;font-size:12px;line-height:1.5}";
var TAG_ID = "dsh-wsl-expose/card.css";
var styles = {
  card: "wanx_card",
  open: "wanx_open",
  header: "wanx_header",
  headText: "wanx_headText",
  name: "wanx_name",
  desc: "wanx_desc",
  chevron: "wanx_chevron",
  chevronOpen: "wanx_chevronOpen",
  body: "wanx_body",
  field: "wanx_field",
  head: "wanx_head",
  label: "wanx_label",
  badges: "wanx_badges",
  badge: "wanx_badge",
  reset: "wanx_reset",
  input: "wanx_input",
  inputInvalid: "wanx_inputInvalid",
  hint: "wanx_hint",
  invalid: "wanx_invalid",
  checkRow: "wanx_checkRow",
  check: "wanx_check",
  footer: "wanx_footer",
  failed: "wanx_failed",
  discard: "wanx_discard",
  save: "wanx_save",
  readOnly: "wanx_readOnly"
};
function injectStylesheet() {
  if (typeof document === "undefined") return;
  if (document.querySelector(`style[data-plugin-css=${JSON.stringify(TAG_ID)}]`) !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-wsl-expose";
  tag.dataset.pluginCss = TAG_ID;
  tag.textContent = css;
  document.head.appendChild(tag);
}
function TextField(props) {
  const { t } = props;
  return (0, import_react.createElement)(
    "div",
    { className: styles.field },
    (0, import_react.createElement)(
      "div",
      { className: styles.head },
      (0, import_react.createElement)("label", { className: styles.label, htmlFor: props.id }, props.label),
      props.overridden ? (0, import_react.createElement)(
        "span",
        { className: styles.badges },
        (0, import_react.createElement)("span", { className: styles.badge }, props.overriddenLabel),
        (0, import_react.createElement)("button", { type: "button", className: styles.reset, disabled: props.disabled, onClick: props.onReset }, props.resetLabel)
      ) : null
    ),
    (0, import_react.createElement)("input", {
      id: props.id,
      className: props.invalid ? styles.inputInvalid : styles.input,
      type: "text",
      ...props.numeric === true ? { inputMode: "numeric" } : {},
      ...props.invalid ? { "aria-invalid": true } : {},
      value: props.text,
      placeholder: props.placeholder ?? "",
      disabled: props.disabled,
      onChange: (event) => props.onEdit(event.target.value)
    }),
    (0, import_react.createElement)("p", { className: props.invalid ? styles.invalid : styles.hint }, props.invalid ? props.invalidLabel : props.hint)
  );
}
function CheckField(props) {
  const { t } = props;
  return (0, import_react.createElement)(
    "div",
    { className: styles.checkRow },
    (0, import_react.createElement)("input", {
      id: props.id,
      className: styles.check,
      type: "checkbox",
      checked: props.checked,
      disabled: props.disabled,
      onChange: () => props.onToggle()
    }),
    (0, import_react.createElement)(
      "div",
      null,
      (0, import_react.createElement)(
        "div",
        { className: styles.head },
        (0, import_react.createElement)("label", { className: styles.label, htmlFor: props.id }, props.label),
        props.overridden ? (0, import_react.createElement)(
          "span",
          { className: styles.badges },
          (0, import_react.createElement)("span", { className: styles.badge }, props.overriddenLabel),
          (0, import_react.createElement)("button", { type: "button", className: styles.reset, disabled: props.disabled, onClick: props.onReset }, props.resetLabel)
        ) : null
      ),
      (0, import_react.createElement)("p", { className: styles.hint }, props.hint)
    )
  );
}
function WslExposeCard(props) {
  const { t } = props;
  const state = props.useWslExposeCard((snapshot) => snapshot);
  const [open, setOpen] = (0, import_react.useState)(false);
  if (!state.available) return null;
  const disabled = !state.writable;
  const blocked = !state.dirty || state.invalid || state.saving;
  return (0, import_react.createElement)(
    "li",
    { className: open ? `${styles.card} ${styles.open}` : styles.card },
    (0, import_react.createElement)(
      "button",
      {
        type: "button",
        className: styles.header,
        "aria-expanded": open,
        "aria-label": `${t(open ? "collapse" : "expand")}: ${t("cardTitle")}`,
        onClick: () => setOpen(!open)
      },
      (0, import_react.createElement)(
        "span",
        { className: styles.headText },
        (0, import_react.createElement)("span", { className: styles.name }, t("cardTitle")),
        (0, import_react.createElement)("span", { className: styles.desc }, t("cardDesc"))
      ),
      state.dirty ? (0, import_react.createElement)("span", { className: styles.badge }, t("unsaved")) : null,
      (0, import_react.createElement)("span", { className: open ? `${styles.chevron} ${styles.chevronOpen}` : styles.chevron }, "\u25BE")
    ),
    open ? (0, import_react.createElement)(
      "div",
      { className: styles.body },
      !state.writable ? (0, import_react.createElement)("p", { className: styles.readOnly, role: "status" }, t("readOnly")) : null,
      (0, import_react.createElement)(TextField, {
        t,
        id: "plugin-config-wan-domain",
        label: t("domainLabel"),
        hint: t("domainHint"),
        overriddenLabel: t("overridden"),
        resetLabel: t("reset"),
        invalidLabel: t("invalidDomain"),
        disabled,
        ...state.domain,
        onEdit: (text) => props.edit("domain", text),
        onReset: () => props.resetField("domain")
      }),
      (0, import_react.createElement)(TextField, {
        t,
        id: "plugin-config-wan-relay",
        label: t("relayLabel"),
        hint: t("relayHint"),
        numeric: true,
        overriddenLabel: t("overridden"),
        resetLabel: t("reset"),
        invalidLabel: t("invalidNumber"),
        disabled,
        ...state.relayPort,
        onEdit: (text) => props.edit("relayPort", text),
        onReset: () => props.resetField("relayPort")
      }),
      (0, import_react.createElement)(TextField, {
        t,
        id: "plugin-config-wan-web",
        label: t("webLabel"),
        hint: t("webHint"),
        numeric: true,
        overriddenLabel: t("overridden"),
        resetLabel: t("reset"),
        invalidLabel: t("invalidNumber"),
        disabled,
        ...state.webPort,
        onEdit: (text) => props.edit("webPort", text),
        onReset: () => props.resetField("webPort")
      }),
      (0, import_react.createElement)(CheckField, {
        t,
        id: "plugin-config-wan-fence",
        label: t("fenceLabel"),
        hint: t("fenceHint"),
        overriddenLabel: t("overridden"),
        resetLabel: t("reset"),
        disabled,
        ...state.fence,
        onToggle: () => props.toggle("fence"),
        onReset: () => props.resetField("fence")
      }),
      (0, import_react.createElement)(
        "div",
        { className: styles.footer },
        state.failed ? (0, import_react.createElement)("p", { className: styles.failed, role: "status" }, t("saveFailed")) : null,
        (0, import_react.createElement)("button", { type: "button", className: styles.discard, disabled: !state.dirty || state.saving, onClick: props.discard }, t("discard")),
        (0, import_react.createElement)("button", { type: "button", className: styles.save, disabled: blocked, onClick: props.save }, t(state.saving ? "saving" : "save"))
      )
    ) : null
  );
}
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-wsl-expose: dictionaries");
  injectStylesheet();
  ctx.inject(["settingsScope"], (scoped) => {
    const form = new CardForm(
      scoped.settingsScope.bind({ namespace: NS }),
      [textField("domain"), numberField("relayPort"), numberField("webPort"), boolField("fence", false)]
    );
    const projection = () => ({
      ...form.shell(),
      domain: form.field("domain"),
      relayPort: form.field("relayPort"),
      webPort: form.field("webPort"),
      fence: form.bool("fence")
    });
    scoped.slots.inject("settings.plugin.item", () => scoped.slots.register({
      name: "settings.plugin.item",
      key: NS,
      locale: NS,
      inject: () => ({
        hooks: { wslExposeCard: form.bind(projection) },
        ...form.actions()
      })
    }, WslExposeCard));
  });
}

		return module.exports;
	}
});
