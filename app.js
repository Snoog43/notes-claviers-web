const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const fr = n => String(n).replace(".", ",");
const PAGE = 50;

let D, cat = "switch", shown = PAGE, view = [];
const state = {q: "", src: new Set(), multi: false, sort: "combine"};

const score = a => a.sur === 100 ? `${fr(a.note)}/100` : `${fr(a.note)}★`;
const last = it => it.avis.map(a => a.date || "").sort().pop() || "";

function apply(){
  const q = norm(state.q).split(/\s+/).filter(Boolean);
  view = D.produits.filter(it => it.cat === cat &&
    (!state.src.size || [...state.src].every(s => it.avis.some(a => a.source === s))) &&
    (!state.multi || new Set(it.avis.map(a => a.source)).size > 1) &&
    q.every(w => it._txt.includes(w)));
  const by = {
    combine: (a, b) => b.combine - a.combine || b.avis.length - a.avis.length,
    nb: (a, b) => new Set(b.avis.map(x => x.source)).size - new Set(a.avis.map(x => x.source)).size || b.combine - a.combine,
    nom: (a, b) => a.nom.localeCompare(b.nom, "fr"),
    date: (a, b) => last(b).localeCompare(last(a)),
  }[state.sort];
  view.sort(by);
}

function sub(a){
  const d = a.details || {};
  if (a.source === "theremingoat") {
    const best = D._tgMax;
    return `<div class="sub">${Object.keys(best).map(k => `<span>${k}</span><span class="bar" title="comparé à la meilleure note de ThereminGoat dans ce critère (${best[k]})"><i style="width:${Math.round(100 * d[k] / best[k])}%"></i></span><span>${d[k]} pts</span>`).join("")}</div>
      <p class="meta">Rang ${d.rang} sur ${D.sources.theremingoat.avis} · total sans pondération ${d.total_brut}/100</p>`;
  }
  if (a.source === "aurore") {
    return `<p class="meta">${esc((d.son || []).join(", "))}${d.prix ? " · " + esc(d.prix) : ""}${d.audios ? ` · ${d.audios} enregistrement${d.audios > 1 ? "s" : ""}` : ""}</p>`;
  }
  return `${d.titre ? `<p class="meta">${esc(d.titre)}</p>` : ""}
    ${d.plus?.length ? `<strong style="font-size:.82rem">Points forts</strong><ul>${d.plus.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    ${d.moins?.length ? `<strong style="font-size:.82rem">Points faibles</strong><ul>${d.moins.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}`;
}

function detail(it){
  return it.avis.map(a => { const s = D.sources[a.source]; return `
    <div class="rv" style="--c:var(--s-${a.source})">
      <h4><span>${esc(s.nom)}</span><span class="sc">${score(a)}</span></h4>
      <p class="meta">${a.date ? "Testé le " + new Date(a.date).toLocaleDateString("fr-FR") + " · " : ""}centile ${a.centile} dans cette source</p>
      ${sub(a)}
      <a class="go" href="${esc(a.url)}" target="_blank" rel="noopener">${a.source === "aurore" ? "Voir la fiche, l'avis et les sons" : a.source === "theremingoat" ? "Voir la fiche de notation (PDF)" : "Lire le test"} →</a>
    </div>`; }).join("");
}

function render(){
  apply();
  $("#result").textContent = `${view.length} produit${view.length > 1 ? "s" : ""}`;
  const rows = view.slice(0, shown);
  $("#list").innerHTML = rows.length ? rows.map((it, i) => `
    <li class="item">
      <button class="head" type="button" aria-expanded="false" data-i="${i}">
        <span class="rank">${i + 1}</span>
        ${it.photo ? `<img class="ph" loading="lazy" src="${esc(it.photo)}" alt="">` : `<span class="ph none">${cat === "switch" ? "▣" : "⌨"}</span>`}
        <span class="name"><h3>${esc(it.nom)}</h3><p>${esc([it.fabricant, it.type].filter(Boolean).join(" · "))}</p></span>
        <span class="badges">${it.avis.map(a => `<span class="b" style="--c:var(--s-${a.source})" title="${esc(D.sources[a.source].nom)}">${esc(D.sources[a.source].nom)} ${score(a)}</span>`).join("")}
          <span class="comb" title="Note combinée (moyenne des rangs centiles)"><strong>${it.combine}</strong><small>combinée</small></span></span>
      </button>
      <div class="detail" hidden></div>
    </li>`).join("") : '<li class="empty">Aucun produit ne correspond.</li>';
  $("#more").hidden = view.length <= shown;
  $("#more").textContent = `Afficher plus (${view.length - shown} restants)`;
}

function setCat(c){
  cat = c; shown = PAGE;
  document.querySelectorAll(".tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.cat === c));
  const srcs = Object.keys(D.sources).filter(s => D.produits.some(it => it.cat === c && it.avis.some(a => a.source === s)));
  [...state.src].forEach(s => { if (!srcs.includes(s)) state.src.delete(s); });
  $("#f-src").innerHTML = `<span class="lab">Testé par</span>` + srcs.map(s => `<button type="button" data-s="${s}" aria-pressed="${state.src.has(s)}">${esc(D.sources[s].nom)}</button>`).join("");
  render();
}

async function init(){
  D = await fetch("data.json").then(r => r.json());
  D.produits.forEach(it => it._txt = norm([it.nom, it.fabricant, it.type].join(" ")));
  D._tgMax = {toucher: 0, stabilité: 0, son: 0, contexte: 0, autre: 0};
  D.produits.forEach(it => it.avis.forEach(a => { if (a.source === "theremingoat") for (const k in D._tgMax) D._tgMax[k] = Math.max(D._tgMax[k], a.details[k]); }));
  $("#sources").innerHTML = Object.entries(D.sources).map(([k, s]) => `
    <li style="--c:var(--s-${k})"><b><a href="${esc(s.lien)}" target="_blank" rel="noopener">${esc(s.nom)}</a><span>${s.avis} notes · ${s.langue}</span></b>
    <span>${esc(s.quoi)} · ${esc(s.echelle)}</span></li>`).join("");
  for (const c of ["switch", "clavier", "keycaps"]) {
    const n = D.produits.filter(p => p.cat === c).length, tab = document.querySelector(`.tabs [data-cat="${c}"]`);
    if (tab) { tab.hidden = !n; $("#n-" + c).textContent = `(${n})`; }
  }

  document.querySelector(".tabs").addEventListener("click", e => { const b = e.target.closest("button"); if (b) setCat(b.dataset.cat); });
  $("#f-src").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    const s = b.dataset.s; state.src.has(s) ? state.src.delete(s) : state.src.add(s);
    b.setAttribute("aria-pressed", state.src.has(s)); shown = PAGE; render();
  });
  $("#q").addEventListener("input", e => { state.q = e.target.value; shown = PAGE; render(); });
  $("#sort").addEventListener("change", e => { state.sort = e.target.value; render(); });
  $("#f-multi").addEventListener("change", e => { state.multi = e.target.checked; shown = PAGE; render(); });
  $("#reset").addEventListener("click", () => {
    Object.assign(state, {q: "", multi: false}); state.src.clear();
    $("#q").value = ""; $("#f-multi").checked = false; shown = PAGE; setCat(cat);
  });
  $("#more").addEventListener("click", () => { shown += PAGE; render(); });
  $("#list").addEventListener("click", e => {
    const h = e.target.closest(".head"); if (!h) return;
    const d = h.nextElementSibling, open = h.getAttribute("aria-expanded") === "true";
    if (!open && !d.innerHTML) d.innerHTML = detail(view[+h.dataset.i]);
    h.setAttribute("aria-expanded", !open); d.hidden = open;
  });
  setCat("switch");
}
init();
