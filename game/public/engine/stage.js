// Big-screen pieces shared by the TV page and the host's STAGE view:
// the brick stage with the crowd of sprites, the QR lobby, live tallies.
import { h, clear } from "./dom.js";
import { spriteEl, avatarName } from "./avatars.js";

// Deterministic x position per player id so sprites don't shuffle on re-render.
function hashX(id) {
  let x = 0;
  for (let i = 0; i < id.length; i++) x = (x * 31 + id.charCodeAt(i)) >>> 0;
  return x;
}

export function crowdStage(container, { phantom = true } = {}) {
  const crowd = h("div", { class: "crowd" });
  const stage = h("div", { class: "stage", "aria-hidden": "true" },
    h("img", { class: "stage-bg px", src: "assets/scene/stage.png", alt: "", width: "966", height: "196" }),
    crowd);
  container.appendChild(stage);
  const seen = new Map();
  if (phantom) {
    const ph = h("div", { class: "av phantom", style: { left: "50%" } },
      h("div", { class: "loading blink" }, "PLAYER 3: LOADING.."),
      h("img", { src: "assets/deco/hearts.png", alt: "", style: { height: "60%", opacity: ".9" } }));
    crowd.appendChild(ph);
  }
  function update(players) {
    const n = Math.max(1, players.length);
    const rows = n > 24 ? 3 : n > 10 ? 2 : 1;
    players.forEach((p, i) => {
      let el = seen.get(p.id);
      if (!el) {
        el = spriteEl(p.avatar, { cls: "in idle", title: p.name + " as " + avatarName(p.avatar) });
        el.appendChild(h("span", { class: "nm" }, p.name));
        seen.set(p.id, el);
        crowd.appendChild(el);
        setTimeout(() => el.classList.remove("in"), 800);
      }
      const row = i % rows;
      const col = Math.floor(i / rows), cols = Math.ceil(n / rows);
      const x = 6 + ((col + 0.5) / cols) * 88 + ((hashX(p.id) % 7) - 3) * 0.4;
      el.style.left = x.toFixed(2) + "%";
      el.style.bottom = (row * 24) + "%";
      el.style.zIndex = String(10 - row);
      // Sprites scale with the stage so a crowd of 80 still fits on the bricks.
      const sw = stage.offsetWidth || 600;
      el.style.height = Math.max(22, Math.round(sw * (n > 40 ? 0.05 : n > 16 ? 0.07 : 0.1))) + "px";
      el.querySelector(".nm").hidden = n > 14;
    });
    for (const [id, el] of seen) if (!players.some((p) => p.id === id)) { el.remove(); seen.delete(id); }
  }
  return { el: stage, update };
}

export function qrBlock(url, { size = 6 } = {}) {
  const wrap = h("div", { class: "qr", "aria-label": "QR code to join" });
  try {
    const qr = window.qrcode(0, "M");
    qr.addData(url);
    qr.make();
    wrap.innerHTML = qr.createSvgTag({ cellSize: size, margin: 0, scalable: true });
  } catch (e) {
    wrap.textContent = url;
  }
  return wrap;
}

export function joinUrl() {
  return location.origin + "/";
}

export function liveBars(container, { max = 10 } = {}) {
  const el = h("div", { class: "live-bars" });
  container.appendChild(el);
  return {
    el,
    update(bars, { unit = "" } = {}) {
      const list = (bars || []).slice(0, max);
      const best = Math.max(1, ...list.map((b) => b.value || 0));
      clear(el);
      list.forEach((b) => {
        el.appendChild(h("div", { class: "lb" },
          h("span", { class: "nm" }, b.name),
          h("span", { class: "bar" }, h("i", { style: { width: Math.round(100 * (b.value || 0) / best) + "%" } })),
          h("span", { class: "v" }, String(b.value || 0) + unit)));
      });
    }
  };
}
