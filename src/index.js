const assign = Object.assign;
const entries = Object.entries;
const protoOf = Object.getPrototypeOf;
const isStr = (d) => typeof d === "string";
const isFunc = (d) => typeof d === "function";
const isExpr = (d) => isFunc(d) && !d.tag && !d.cf;
const isNode = (d) => isFunc(d) && d.tag;
const isControl = (d) => isFunc(d) && d.cf;
const isDef = (d) => d !== undefined;
const cache = {};

const from = (obj, callback) => Object.fromEntries(entries(obj).map(([k, v]) => [k, callback(v, k)]));

class Reactive {
  constructor() {
    this._defaults = {children: () => []};
    this._states = {};
  }
  prop(k, v) {
    this._defaults[k] = v;
    return this;
  }
  state(k, v) {
    this._states[k] = v;
    return this;
  }
  join(props) {
    const defaults = from(this._defaults, (v) => v?.());
    const states = from(this._states, (v) => v());
    return new Proxy(Object.create(null), {
      get: (t, k) => {
        const prop = props?.[k] ?? defaults[k];
        if (k in defaults) return isExpr(prop) ? prop() : prop;
        if (k in states) return states[k];
        return t[k];
      },
    });
  }
}

export function reactive() {
  return new Reactive();
}

const setterOf = (proto, k) => proto && (Object.getOwnPropertyDescriptor(proto, k) ?? setterOf(protoOf(proto), k));

function render(template, scope) {
  const node = scope ? hydrate(template, scope) : template;
  if (!node) return [];
  if (isControl(node)) return node(render).flat(Infinity);
  if (isExpr(node)) return [document.createTextNode(node())];
  if (!isFunc(node)) return [document.createTextNode(node)];
  if (isStr(node.tag)) {
    const {tag, ns, props, children} = node;
    const el = ns ? document.createElementNS(ns, tag) : document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      const setter = (cache[tag + "," + k] ??= setterOf(el, k)?.set ?? 0).bind?.(el) ?? el.setAttribute.bind(el, k);
      let old;
      const event = (v) => {
        const name = k.slice(2);
        el.removeEventListener(name, old);
        el.addEventListener(name, (old = v()));
      };
      const attr = (v) => setter(v());
      (k.startsWith("on") ? event : isExpr(v) ? attr : setter)(v);
    }
    for (const child of children) el.append(...render(child));
    return [el];
  }
  const {tag, props, children} = node;
  return render(tag[1], tag[0].join(assign(props, {children})));
}

const node =
  (tag, ns) =>
  (props = {}) => {
    const create = (...c) => ((create.children = c), create);
    return assign(create, {props, tag, ns, children: []});
  };

const bind =
  (fn, scope) =>
  (...params) =>
    fn(scope, ...params);

const hydrate = (d, scope) => {
  if (isExpr(d)) return bind(d, scope);
  if (isControl(d)) return assign(bind(d, scope), {cf: d.cf});
  if (!isNode(d)) return d;
  const {tag, ns, props, children} = d;
  const newProps = from(props, (v) => (isExpr(v) ? bind(v, scope) : v));
  return node(tag, ns)(newProps)(...children.map((d) => hydrate(d, scope)));
};

const handler = (ns) => ({get: (_, tag) => node(tag, ns)});

export const X = new Proxy((ns) => new Proxy({}, handler(ns)), handler());

export const component = (...params) => node(params[1] ? params : [reactive(), params[0]]);

export const controlFlow = (...params) => {
  const [join, template] = params[1] ? params : [reactive(), params[0]];
  return component(join, assign(template, {cf: true}));
};

export const Fragment = controlFlow((d, h) => d.children.map((child) => h(child)));

export const Slot = controlFlow(
  reactive().prop("from", (d) => () => d.children),
  (d, h, _) => ((_ = [d.from].flat(Infinity)), _.length ? _ : d.children).map((child) => h(child)),
);

export const Match = controlFlow(reactive().prop("test").prop("value"), (d, h) => {
  if (isDef(d.test)) return h(d.children[+!d.test], {}, 0);
  const test = ({props: {test: _}}) => (isDef(d.value) ? _ === d.value : isFunc(_) && _());
  return d.children.find((c) => c.tag[1]?.arm && (!c.props?.test || test(c)))?.children.map((c) => h(c)) ?? [];
});

export const Arm = controlFlow(
  reactive().prop("test"),
  assign(() => {}, {arm: true}),
);

export const For = controlFlow(
  reactive().prop("each"),
  (d, h) =>
    d.each?.map((val, index) =>
      d.children.map((child) =>
        h(
          child,
          reactive()
            .state("val", () => val)
            .state("index", () => index)
            .join(),
        ),
      ),
    ) ?? [],
);

export const mount = (el, node) => el.append(...render(node));

export default {X, component, mount, reactive, Fragment, Slot, Match, Arm, For};
