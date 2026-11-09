const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { runInNewContext } = require("node:vm");
const { Pessoa } = require("../models");
const routes = require("../api");

const scripts = join(__dirname, "../../amigo-oculto-front/js");

class Element {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.style = {};
    this.attributes = {};
    this.content = "";
    this.listeners = {};
  }
  set textContent(value) { this.children = []; this.content = String(value); }
  get textContent() { return this.content + this.children.map((child) => child.textContent).join(""); }
  set innerHTML(_value) { throw Error("HTML parsing is not safe for participant data"); }
  replaceChildren() { this.children = []; this.content = ""; }
  append(...children) {
    for (const child of children) child.parent = this;
    this.children.push(...children);
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  contains(element) { return element === this || this.children.some((child) => child.contains(element)); }
  closest(selector) {
    for (let node = this; node; node = node.parent) {
      if (selector === "tr" && node.tagName === "tr") return node;
      if (selector === ".botao-copiar" && node.className?.split(" ").includes("botao-copiar")) return node;
    }
    return null;
  }
  querySelector(selector) {
    for (const child of this.children) {
      if (selector === "a[href]" && child.tagName === "a" && child.href) return child;
      if (selector === ".toast-body" && child.className === "toast-body") return child;
      const found = child.querySelector(selector);
      if (found) return found;
    }
    return null;
  }
  select() {}
  remove() { this.parent.children = this.parent.children.filter((child) => child !== this); }
}

function render(file, people, restrictions = []) {
  const tbody = new Element("tbody");
  const toast = new Element("div");
  const message = new Element("div");
  message.className = "toast-body";
  toast.append(message);
  const document = {
    querySelector: (selector) => selector === "#liveToast" ? toast : tbody,
    body: new Element("body"),
    execCommand: () => false,
    createElement: (tag) => new Element(tag),
    createTextNode: (text) => {
      const node = new Element("#text");
      node.textContent = text;
      return node;
    },
  };
  const context = {
    document,
    window: { apiDomain: "https://amigo-oculto-back.onrender.com", apiFetch: () => new Promise(() => {}) },
    domain: "https://amigo-oculto-back.onrender.com",
    navigator: {}, console: { warn() {}, error() {} },
    bootstrap: { Toast: class { show() { toast.shown = true; } } },
  };
  runInNewContext(readFileSync(join(scripts, file), "utf8"), context);
  if (file === "restricoes.js") context.preencheTabela(people, restrictions);
  else context.preencheTabela(people);
  tbody.testContext = context;
  tbody.toast = toast;
  return tbody;
}

test("admin tables render untrusted names, nicks and hashes as text rather than HTML", () => {
  const payload = '<img src=x onerror=alert(1)>';
  const people = [{ id: 7, nome_completo: payload, nick: payload, hash: payload, escolheu: false, escolhido: false, data: null }];
  for (const file of ["get-users.js", "get-simple-list.js", "restricoes.js"]) {
    const table = render(file, people);
    assert.equal(table.children.length, 1, file);
    assert.equal(table.children[0].children[1].textContent, payload, file);
    assert.ok(table.textContent.includes(payload), file);
  }
  const listing = render("get-simple-list.js", people);
  const link = listing.children[0].children[3].children[0];
  assert.equal(link.href, `https://amigo-oculto-back.onrender.com/u/${encodeURIComponent(payload)}`);
  assert.equal(link.textContent, link.href);
  const restrictions = render("restricoes.js", people, [{ id_retira: 7, id_escolhido: 7 }]);
  const label = restrictions.children[0].children[2].children[0].children[1].children[0].children[0];
  assert.equal(label.children[0].checked, true);
  assert.equal(label.children[0].disabled, true);
  assert.equal(label.textContent, ` ${payload}`);
});

test("new participant links use random tokens without changing existing hashes", async () => {
  const post = routes.stack.find((layer) => layer.route?.path === "/" && layer.route.methods.post).route.stack[0].handle;
  const originalMax = Pessoa.max;
  const originalCreate = Pessoa.create;
  const saved = [];
  Pessoa.max = async () => { throw Error("MAX(id) must not be used"); };
  Pessoa.create = async (data) => { saved.push(data); return data; };
  try {
    for (let i = 0; i < 2; i++) {
      const req = { body: { nome_completo: "Mesmo nome", nick: "Teste", escolheu: false, escolhido: false } };
      const res = { status(code) { assert.equal(code, 201); return this; }, json() {} };
      await post(req, res);
    }
    assert.match(saved[0].hash, /^[a-f0-9]{64}$/);
    assert.match(saved[1].hash, /^[a-f0-9]{64}$/);
    assert.notEqual(saved[0].hash, saved[1].hash);
    assert.equal(saved[0].id, undefined);
  } finally {
    Pessoa.max = originalMax;
    Pessoa.create = originalCreate;
  }
});

test("list navigation and copy work on both button and icon, with fallback and failure feedback", async () => {
  const html = readFileSync(join(scripts, "../index.html"), "utf8");
  assert.match(html, /href="listagem\.html"[^>]*>Listagem e links<\/a>/);

  const table = render("get-simple-list.js", [{ id: 7, nome_completo: "Teste", nick: "T", hash: "abc" }]);
  const row = table.children[0];
  const button = row.children[4].children[0];
  const icon = button.children[0];
  const url = row.children[3].children[0].href;
  const copied = [];
  table.testContext.navigator.clipboard = { writeText: async (value) => copied.push(value) };
  await table.listeners.click({ target: icon });
  await table.listeners.click({ target: button });
  assert.deepEqual(copied, [url, url]);
  assert.equal(table.toast.querySelector(".toast-body").textContent, "Link copiado com sucesso!");

  table.testContext.navigator.clipboard = { writeText: async () => { throw Error("blocked"); } };
  table.testContext.document.execCommand = (command) => {
    assert.equal(command, "copy");
    assert.equal(table.testContext.document.body.children[0].value, url);
    return true;
  };
  await table.listeners.click({ target: icon });
  assert.equal(table.testContext.document.body.children.length, 0);
  assert.equal(table.toast.querySelector(".toast-body").textContent, "Link copiado com sucesso!");

  table.testContext.document.execCommand = () => false;
  await table.listeners.click({ target: icon });
  assert.match(table.toast.querySelector(".toast-body").textContent, /Selecione e copie/);
  assert.equal(table.toast.className, "toast text-bg-danger");
});
