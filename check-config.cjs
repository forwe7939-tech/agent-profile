// Sanity check: strip // comments only when outside a string, then parse JSONC.
const fs = require("node:fs");
const path = process.argv[2];
const src = fs.readFileSync(path, "utf8");

let out = "";
let inStr = false;
let quote = "";
let escaped = false;

for (let i = 0; i < src.length; i++) {
  const c = src[i];
  if (inStr) {
    out += c;
    if (escaped) { escaped = false; continue; }
    if (c === "\\") { escaped = true; continue; }
    if (c === quote) { inStr = false; }
    continue;
  }
  if (c === '"' || c === "'") { inStr = true; quote = c; out += c; continue; }
  if (c === "/" && src[i + 1] === "/") {
    while (i < src.length && src[i] !== "\n") i++;
    out += "\n";
    continue;
  }
  if (c === "/" && src[i + 1] === "*") {
    i += 2;
    while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
    i++;
    continue;
  }
  out += c;
}

let o;
try {
  // JSONC allows trailing commas; JSON.parse does not.
  const noTrailing = out.replace(/,(\s*[}\]])/g, "$1");
  o = JSON.parse(noTrailing);
} catch (e) {
  console.log("PARSE FAIL: " + e.message);
  process.exit(1);
}

const rules = o.permissions || [];
const actions = [...new Set(rules.map((r) => r.action))];
const providers = o.providers || {};
const models = Object.values(providers).reduce(
  (n, v) => n + Object.keys(v.models || {}).length,
  0,
);
const bad = rules.filter(
  (r) => !r.action || !r.resource || !r.effect,
);
const badEffect = rules.filter(
  (r) => !["allow", "deny", "ask"].includes(r.effect),
);
const badPkg = Object.entries(providers).filter(
  ([, v]) => !v.package || !v.settings?.baseURL,
);

console.log("PARSE OK");
console.log("rules        :", rules.length);
console.log("actions      :", actions.join(", "));
console.log("providers    :", Object.keys(providers).join(", "));
console.log("models       :", models);
console.log("skills       :", JSON.stringify(o.skills));
console.log("malformed    :", bad.length);
console.log("bad effect   :", badEffect.length);
console.log("bad provider :", badPkg.length);
console.log(
  "compaction   :",
  JSON.stringify(o.compaction || null),
);
