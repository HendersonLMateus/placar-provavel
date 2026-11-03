/*
 * Gera o site estático em _site/ a partir de dados/jogos.json, em português (raiz) e inglês (/en/).
 * Uso: node scripts/build.js   (sem dependências)
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RAIZ = path.join(__dirname, "..");
const SAIDA = path.join(RAIZ, "_site");
const site = JSON.parse(fs.readFileSync(path.join(RAIZ, "site.json"), "utf8"));
const BASE = site.url.replace(/\/$/, "");
const ARQ_DADOS = process.env.DADOS || path.join(RAIZ, "dados/jogos.json");
const dados = JSON.parse(fs.readFileSync(ARQ_DADOS, "utf8"));

// Carrega o modelo e as funções comuns do próprio site, para os números baterem com o admin.
const vmctx = {};
vm.createContext(vmctx);
vm.runInContext(fs.readFileSync(path.join(RAIZ, "modelo.js"), "utf8"), vmctx);
vm.runInContext(fs.readFileSync(path.join(RAIZ, "comum.js"), "utf8"), vmctx);
const { esc, pct, jogado, fav, res, brier, ordData, placares } = vmctx;

/* ---------- idioma ---------- */
// Cada página é gerada duas vezes: lg = "pt" (raiz do site) e lg = "en" (pasta /en/).
let lg = "pt";
const T = (pt, en) => (lg === "en" ? en : pt);
const LANGS = ["pt", "en"];
const HTML_LANG = { pt: "pt-BR", en: "en" };
const OG_LOCALE = { pt: "pt_BR", en: "en_US" };
const cartao = (j) => vmctx.cartao(j, "", lg);
const descricaoSite = () => T(site.descricao, site.descricaoEn ||
  "Probabilities from a statistical goals model for Brazilian league (Brasileirão) matches: win, draw, expected goals, most likely score and a public track record.");

/* ---------- utilidades ---------- */
const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const LIGAS = { "Brasileirão Série A": "Brasileirão Série A", "Serie A": "Brasileirão Série A", "Serie B": "Brasileirão Série B", "Serie C": "Brasileirão Série C" };
const nomeLiga = (l) => LIGAS[l] || l || "Brasileirão";
const dataLonga = (d) => { if (!d) return ""; const [a, m, dd] = d.split("-"); return T(`${+dd} de ${MESES[+m - 1]} de ${a}`, `${MONTHS[+m - 1]} ${+dd}, ${a}`); };
const dataCurta = (d) => { if (!d) return ""; const [a, m, dd] = d.split("-"); return T(`${dd}/${m}/${a}`, `${MONTHS[+m - 1].slice(0, 3)} ${+dd}, ${a}`); };
const diaMes = (d) => vmctx.dataCurtaL(d, lg);
const num = (x, c = 2) => vmctx.numL(x, c, lg);
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const slugify = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// Nomes do Primatips vêm com a UF ("Bahia BA") ou já em português ("Atlético-MG"). nomes.json traz a grafia
// usada no site e desfaz ambiguidades (Atlético-MG x Athletico-PR); os demais perdem só a sigla do estado.
const NOMES = fs.existsSync(path.join(RAIZ, "nomes.json")) ? JSON.parse(fs.readFileSync(path.join(RAIZ, "nomes.json"), "utf8")) : {};
const nomeTime = (t) => NOMES[t] || String(t || "").replace(/\s+[A-Z]{2}$/, "");
const hoje = new Date().toISOString().slice(0, 10);
const maxData = (...ds) => ds.filter(Boolean).sort().pop();

/* ---------- endereços ---------- */
// Todos os endereços são relativos à raiz do site; cada página soma o prefixo "raiz" ("./", "../", "../../").
const U = {
  inicio: (l = lg) => (l === "en" ? "en/" : ""),
  times: (l = lg) => (l === "en" ? "en/teams.html" : "times.html"),
  metodo: (l = lg) => (l === "en" ? "en/how-it-works.html" : "como-funciona.html"),
  jogo: (j, l = lg) => {
    const fim = j.data ? "-" + j.data : "-" + j.id;
    return l === "en" ? `en/matches/${slugify(j.casa)}-vs-${slugify(j.fora)}${fim}.html` : `jogos/${slugify(j.casa)}-x-${slugify(j.fora)}${fim}.html`;
  },
  time: (t, l = lg) => (l === "en" ? `en/teams/${slugify(t)}.html` : `times/${slugify(t)}.html`),
  rodada: (liga, n, l = lg) => {
    const s = slugify(liga.replace(/^Brasileirão\s+/, ""));
    return l === "en" ? `en/rounds/${s}-round-${n}.html` : `rodadas/${s}-rodada-${n}.html`;
  },
};
const arquivo = (u) => (u === "" ? "index.html" : u.endsWith("/") ? u + "index.html" : u);
const raizDe = (u) => { const n = arquivo(u).split("/").length - 1; return n ? "../".repeat(n) : "./"; };
const absoluto = (u) => `${BASE}/${u}`;
const ambos = (fn) => ({ pt: fn("pt"), en: fn("en") });

function escrever(rel, conteudo) {
  const p = path.join(SAIDA, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, conteudo);
}
function copiar(rel) {
  const de = path.join(RAIZ, rel);
  if (!fs.existsSync(de)) return;
  const para = path.join(SAIDA, rel);
  fs.mkdirSync(path.dirname(para), { recursive: true });
  fs.copyFileSync(de, para);
}

/* ---------- quando a previsão foi registrada ---------- */
// O admin grava registradoEm. Jogos anteriores a isso têm o momento do registro no próprio id ("j" + Date.now() em base 36).
function registradoEm(j) {
  if (j.registradoEm) return new Date(j.registradoEm);
  if (/^j[0-9a-z]{7,}$/.test(j.id)) { const t = parseInt(j.id.slice(1), 36); if (t > 1.6e12 && t < 4e12) return new Date(t); }
  return null;
}
const isoDia = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const ultimaMudanca = (j) => maxData(isoDia(j.atualizadoEm), isoDia(registradoEm(j)), j.data) || dados.atualizado || hoje;

/* ---------- layout comum ---------- */
function migalhas(itens, raiz) {
  return `<nav class="migalhas" aria-label="${T("Você está em", "You are here")}"><ol>${itens.map((it, i) =>
    i === itens.length - 1 ? `<li aria-current="page">${esc(it.nome)}</li>` : `<li><a href="${raiz}${it.url}">${esc(it.nome)}</a></li>`).join("")}</ol></nav>`;
}
function ldMigalhas(itens) {
  return { "@type": "BreadcrumbList", itemListElement: itens.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.nome, item: absoluto(it.url) })) };
}

// Seletor de idioma no topo e aviso discreto para quem usa o navegador no outro idioma.
function seletorIdioma(alt, raiz) {
  const item = (l, rotulo, nome) => l === lg
    ? `<a href="${raiz}${alt[l]}" lang="${HTML_LANG[l]}" hreflang="${HTML_LANG[l]}" aria-current="true" title="${nome}">${rotulo}</a>`
    : `<a href="${raiz}${alt[l]}" lang="${HTML_LANG[l]}" hreflang="${HTML_LANG[l]}" data-idioma="${l}" title="${nome}">${rotulo}</a>`;
  return `<div class="idioma" role="group" aria-label="Idioma / Language">${item("pt", "PT", "Português")}${item("en", "EN", "English")}</div>`;
}
function avisoIdioma(alt, raiz) {
  const outro = lg === "en" ? "pt" : "en";
  const texto = outro === "en" ? "This page is also available in English." : "Esta página também está disponível em português.";
  const botao = outro === "en" ? "Read in English" : "Ler em português";
  const fechar = outro === "en" ? "Dismiss" : "Fechar";
  return `<div class="aviso-idioma" id="aviso-idioma" hidden lang="${HTML_LANG[outro]}"><span>${texto}</span><a href="${raiz}${alt[outro]}" data-idioma="${outro}">${botao} →</a><button type="button" id="fechar-aviso" aria-label="${fechar}">×</button></div>
<script>
(function(){
  var guardar = function(k, v){ try { localStorage.setItem(k, v); } catch (e) {} };
  var ler = function(k){ try { return localStorage.getItem(k); } catch (e) { return null; } };
  document.querySelectorAll("[data-idioma]").forEach(function(a){ a.addEventListener("click", function(){ guardar("pp-idioma", a.getAttribute("data-idioma")); }); });
  var pref = ler("pp-idioma");
  var nav = ((navigator.languages && navigator.languages[0]) || navigator.language || "").toLowerCase();
  var querOutro = pref ? pref === "${outro}" : ${outro === "en" ? '!nav.startsWith("pt")' : 'nav.startsWith("pt")'};
  if (!querOutro || ler("pp-aviso-fechado") === "${lg}") return;
  var el = document.getElementById("aviso-idioma"); el.hidden = false;
  document.getElementById("fechar-aviso").addEventListener("click", function(){ el.hidden = true; guardar("pp-aviso-fechado", "${lg}"); });
})();
</script>`;
}

function pagina({ titulo, descricao, alt, corpo, jsonld, tipo = "website", noindex = false }) {
  const caminho = alt[lg];
  const raiz = noindex ? BASE + "/" : raizDe(caminho);
  const canon = absoluto(caminho);
  const atual = (u) => (caminho === u ? ' aria-current="page"' : "");
  const metodo = U.metodo();
  return `<!doctype html>
<html lang="${HTML_LANG[lg]}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descricao)}">
${site.goatcounter && !noindex ? `<script data-goatcounter="${esc(site.goatcounter)}" async src="https://gc.zgo.at/count.js"></script>` : ""}
${site.googleVerificacao ? `<meta name="google-site-verification" content="${esc(site.googleVerificacao)}">` : ""}
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${canon}">
<link rel="alternate" hreflang="pt-BR" href="${absoluto(alt.pt)}">
<link rel="alternate" hreflang="en" href="${absoluto(alt.en)}">
<link rel="alternate" hreflang="x-default" href="${absoluto(alt.pt)}">`}
<meta property="og:type" content="${tipo}">
<meta property="og:site_name" content="${esc(site.nome)}">
<meta property="og:locale" content="${OG_LOCALE[lg]}">
<meta property="og:locale:alternate" content="${OG_LOCALE[lg === "en" ? "pt" : "en"]}">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descricao)}">
<meta property="og:url" content="${canon}">
<meta property="og:image" content="${BASE}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${raiz}favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="${raiz}estilo.css">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, "\\u003c")}</script>` : ""}
</head>
<body>
<div class="wrap">
${noindex ? "" : avisoIdioma(alt, raiz)}
<nav class="topo" aria-label="${T("Principal", "Main")}"><a class="marca" href="${raiz}${U.inicio()}">${esc(site.nome)}</a><span class="menu"><a href="${raiz}${U.inicio()}"${atual(U.inicio())}>${T("Previsões", "Predictions")}</a><a href="${raiz}${U.times()}"${atual(U.times())}>${T("Times", "Teams")}</a><a href="${raiz}${metodo}"${atual(metodo)}>${T("Como funciona", "How it works")}</a></span>${noindex ? "" : seletorIdioma(alt, raiz)}</nav>
${corpo}
<footer class="aviso"><p>${T("O Placar Provável é um projeto de estatística aplicada ao futebol. As probabilidades vêm de um modelo matemático de gols, calculado com dados públicos das partidas, e mostram tendências, não certezas: um resultado com 60% de chance deixa de acontecer em 4 de cada 10 jogos. Erros e acertos ficam registrados no histórico do modelo.",
    "Placar Provável is a statistics project about football. The probabilities come from a mathematical goals model built on public match data, and they show tendencies, not certainties: an outcome with a 60% chance fails to happen in 4 out of 10 matches. Hits and misses stay on the model's record.")}${caminho === metodo || noindex ? "" : ` <a href="${raiz}${metodo}">${T("Veja como o modelo funciona", "See how the model works")}</a>.`}</p></footer>
</div>
</body>
</html>
`;
}

/* ---------- textos ---------- */
const ord = (n) => T(`${n}º`, `${n}${(n % 100 >= 11 && n % 100 <= 13) ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th")}`);

function resumoJogo(j) {
  const c = j.casa, f = j.fora, F = fav(j);
  let t;
  if (F === "1") t = T(`O modelo aponta o ${c} como favorito jogando em casa, com ${pct(j.p1)} de chance de vitória, contra ${pct(j.p2)} do ${f} e ${pct(j.px)} de empate.`,
    `The model has ${c} as the favourite at home, with a ${pct(j.p1)} chance of winning, against ${pct(j.p2)} for ${f} and ${pct(j.px)} for a draw.`);
  else if (F === "2") t = T(`O modelo aponta o ${f} como favorito mesmo fora de casa, com ${pct(j.p2)} de chance de vitória, contra ${pct(j.p1)} do ${c} e ${pct(j.px)} de empate.`,
    `The model has ${f} as the favourite even away from home, with a ${pct(j.p2)} chance of winning, against ${pct(j.p1)} for ${c} and ${pct(j.px)} for a draw.`);
  else t = T(`O modelo vê um jogo equilibrado, com o empate como resultado mais provável (${pct(j.px)}), contra ${pct(j.p1)} do ${c} e ${pct(j.p2)} do ${f}.`,
    `The model sees an even match, with a draw as the most likely outcome (${pct(j.px)}), against ${pct(j.p1)} for ${c} and ${pct(j.p2)} for ${f}.`);
  if (F !== "X" && Math.abs(j.p1 - j.p2) < 0.1) t += T(" A diferença entre os dois lados é pequena, então o favoritismo é leve.", " The gap between the two sides is small, so the edge is slight.");
  return t;
}
function golsJogo(j) {
  const tot = j.xgc + j.xgf;
  const ritmo = tot >= 2.9 ? T("acima da média do campeonato", "above the league average") : tot <= 2.3 ? T("abaixo da média do campeonato", "below the league average") : T("perto da média do campeonato", "close to the league average");
  return T(`A expectativa é de ${num(j.xgc)} gol para o ${j.casa} e ${num(j.xgf)} para o ${j.fora}, num total de ${num(tot, 1)} gols, ${ritmo}. Isso dá ${pct(j.o25)} de chance de mais de 2,5 gols e ${pct(j.bts)} de os dois times marcarem.`,
    `The model expects ${num(j.xgc)} goals for ${j.casa} and ${num(j.xgf)} for ${j.fora}, ${num(tot, 1)} in total, ${ritmo}. That gives a ${pct(j.o25)} chance of more than 2.5 goals and ${pct(j.bts)} of both teams scoring.`);
}
function textoResultado(j) {
  const r = `${j.casa} ${j.gc} x ${j.gf} ${j.fora}`;
  const quem = fav(j) === "1" ? j.casa : fav(j) === "2" ? j.fora : T("o empate", "a draw");
  const pr = { "1": j.p1, "X": j.px, "2": j.p2 }[res(j)];
  return fav(j) === res(j) ? T(`Resultado final: ${r}. O favorito do modelo (${quem}) confirmou a previsão.`, `Final score: ${r}. The model's favourite (${quem}) delivered.`)
    : T(`Resultado final: ${r}. O modelo apontava ${quem}; o resultado que aconteceu tinha ${pct(pr)} de probabilidade. Previsões erradas continuam no histórico, junto com as certas.`,
      `Final score: ${r}. The model favoured ${quem}; the actual outcome had a ${pct(pr)} probability. Misses stay on the record, alongside the hits.`);
}
// Situação na tabela em linguagem simples ("8º colocado, com 46 pontos, a 4 pontos do G-6")
function situacao(t, ref) {
  const pts = (n) => T(plural(n, "ponto", "pontos"), plural(n, "point", "points"));
  let s = T(`${ord(t.pos)} colocado, com ${t.pts} pontos em ${t.j} jogos`, `${ord(t.pos)} with ${t.pts} points from ${t.j} matches`);
  if (!ref) return s;
  if (t.pos === 1) s += T(", na liderança", ", top of the table");
  else if (t.pos <= 4) s += ref.lider - t.pts <= 6 ? T(`, a ${pts(ref.lider - t.pts)} do líder`, `, ${pts(ref.lider - t.pts)} off the top`) : T(", no G-4", ", in the top 4");
  else if (t.pos <= 6) s += T(`, a ${pts(ref.g4 - t.pts)} do G-4`, `, ${pts(ref.g4 - t.pts)} off the top 4`);
  else if (t.pos >= 17) s += T(", na zona de rebaixamento", ", in the relegation zone");
  else if (t.pts - ref.z4 <= 6) s += T(`, ${pts(t.pts - ref.z4)} acima da zona de rebaixamento`, `, ${pts(t.pts - ref.z4)} above the relegation zone`);
  else if (ref.g6 - t.pts <= 6) s += T(`, a ${pts(ref.g6 - t.pts)} do G-6`, `, ${pts(ref.g6 - t.pts)} off the top 6`);
  return s;
}
const vedTexto = (v, e, d) => T(`${plural(v, "vitória", "vitórias")}, ${plural(e, "empate", "empates")} e ${plural(d, "derrota", "derrotas")}`,
  `${plural(v, "win", "wins")}, ${plural(e, "draw", "draws")} and ${plural(d, "loss", "losses")}`);
const contaForma = (u) => { const v = u.filter((x) => x.r === "V").length, e = u.filter((x) => x.r === "E").length; return vedTexto(v, e, u.length - v - e); };
const camp = (a) => vedTexto(a[0], a[1], a[2]);
const LETRA = { V: ["V", "W"], E: ["E", "D"], D: ["D", "L"] };
const forma = (u) => `<span class="forma" aria-label="${esc(contaForma(u))}">${u.map((x) => `<i class="r${x.r}" title="${esc(`${x.m === "c" ? T("Em casa", "Home") : T("Fora", "Away")} ${T("contra", "vs")} ${nomeTime(x.adv)}: ${x.gp} x ${x.gs}`)}">${T(LETRA[x.r][0], LETRA[x.r][1])}</i>`).join("")}</span>`;

function secaoContexto(j, raiz) {
  const x = j.ctx;
  if (!x) return "";
  const c = j.casa, f = j.fora, partes = [];
  if (x.tc || x.tf) {
    const frases = [];
    if (x.tc) frases.push(T(`O ${c} é o ${situacao(x.tc, x.ref)}.`, `${c} are ${situacao(x.tc, x.ref)}.`));
    if (x.tf) frases.push(T(`O ${f} é o ${situacao(x.tf, x.ref)}.`, `${f} are ${situacao(x.tf, x.ref)}.`));
    partes.push(`<section><h2>${T("Situação na tabela", "League position")}</h2><p>${esc(frases.join(" "))}</p></section>`);
  }
  if (x.uc || x.uf || x.cc) {
    let h = `<section><h2>${T("Momento dos times", "Current form")}</h2>`;
    const linhas = [];
    if (x.uc && x.uc.length) linhas.push(`<tr><td><a href="${raiz}${U.time(c)}">${esc(c)}</a></td><td>${forma(x.uc)}</td></tr>`);
    if (x.uf && x.uf.length) linhas.push(`<tr><td><a href="${raiz}${U.time(f)}">${esc(f)}</a></td><td>${forma(x.uf)}</td></tr>`);
    if (linhas.length) h += `<div class="tablewrap"><table><thead><tr><th>${T("Time", "Team")}</th><th>${T("Últimos 5 jogos", "Last 5 matches")}</th></tr></thead><tbody>${linhas.join("")}</tbody></table></div>`;
    const frases = [];
    if (x.uc && x.uc.length) frases.push(T(`Nos últimos ${x.uc.length} jogos, o ${c} somou ${contaForma(x.uc)}.`, `In their last ${x.uc.length} matches, ${c} have ${contaForma(x.uc)}.`));
    if (x.uf && x.uf.length) frases.push(T(`O ${f} tem ${contaForma(x.uf)} no mesmo período.`, `${f} have ${contaForma(x.uf)} over the same stretch.`));
    if (x.cc) frases.push(T(`Jogando em casa no campeonato, o ${c} tem ${camp(x.cc)}.`, `At home in the league, ${c} have ${camp(x.cc)}.`));
    if (x.cf) frases.push(T(`Fora de casa, o ${f} tem ${camp(x.cf)}.`, `Away from home, ${f} have ${camp(x.cf)}.`));
    if (frases.length) h += `<p>${esc(frases.join(" "))}</p>`;
    h += `<p class="muted nota">${T("Mais recente à esquerda. A sequência inclui todas as competições.", "Most recent on the left. Includes all competitions.")}</p></section>`;
    partes.push(h);
  }
  if (x.h2h && x.h2h.length) {
    const nc = slugify(c), nf = slugify(f);
    let vc = 0, vf = 0, e = 0;
    const linhas = x.h2h.map((p) => {
      const pc = nomeTime(p.c), pf = nomeTime(p.f);
      if (p.gc === p.gf) e++; else { const venc = slugify(p.gc > p.gf ? pc : pf); if (venc === nc) vc++; else if (venc === nf) vf++; }
      return `<tr><td>${esc(dataCurta(p.d))}</td><td>${esc(pc)} ${p.gc} x ${p.gf} ${esc(pf)}</td></tr>`;
    }).join("");
    partes.push(`<section><h2>${T("Confronto direto", "Head to head")}</h2><p>${esc(T(`Nos últimos ${x.h2h.length} encontros, o ${c} venceu ${vc}, o ${f} venceu ${vf} e houve ${plural(e, "empate", "empates")}.`,
      `In the last ${x.h2h.length} meetings, ${c} won ${vc}, ${f} won ${vf} and ${e === 1 ? "1 was a draw" : `${e} were draws`}.`))}</p>
<div class="tablewrap"><table><thead><tr><th>${T("Data", "Date")}</th><th>${T("Jogo", "Match")}</th></tr></thead><tbody>${linhas}</tbody></table></div></section>`);
  }
  return partes.join("\n");
}

/* ---------- página de jogo ---------- */
function paginaJogo(j) {
  const c = j.casa, f = j.fora, liga = j.liga;
  const alt = ambos((l) => U.jogo(j, l)), raiz = raizDe(alt[lg]);
  const tops = placares(j.xgc, j.xgf, 5);
  const quando = j.data ? ` (${diaMes(j.data)})` : "";
  const titulo = T(`${c} x ${f}${quando}: prognóstico e probabilidades`, `${c} vs ${f}${quando}: prediction and probabilities`);
  let descricao = T(`${c} x ${f} pelo ${liga}${j.data ? " em " + dataLonga(j.data) : ""}: ${pct(j.p1)} vitória do ${c}, ${pct(j.px)} empate, ${pct(j.p2)} vitória do ${f}. Placar mais provável ${tops[0].gc} x ${tops[0].gf}.`,
    `${c} vs ${f} in the ${liga}${j.data ? " on " + dataLonga(j.data) : ""}: ${pct(j.p1)} ${c} win, ${pct(j.px)} draw, ${pct(j.p2)} ${f} win. Most likely score ${tops[0].gc}-${tops[0].gf}.`);
  if (j.ctx && j.ctx.tc && j.ctx.tf) descricao += T(` ${ord(j.ctx.tc.pos)} contra ${ord(j.ctx.tf.pos)} na tabela.`, ` ${ord(j.ctx.tc.pos)} against ${ord(j.ctx.tf.pos)} in the table.`);
  const itens = [{ nome: T("Início", "Home"), url: U.inicio() }];
  if (j.rodada) itens.push({ nome: T(`Rodada ${j.rodada}`, `Round ${j.rodada}`), url: U.rodada(liga, j.rodada) });
  itens.push({ nome: T(`${c} x ${f}`, `${c} vs ${f}`), url: alt[lg] });
  const evento = {
    "@type": "SportsEvent", name: T(`${c} x ${f}`, `${c} vs ${f}`), sport: T("Futebol", "Football"), description: descricao, inLanguage: HTML_LANG[lg],
    ...(j.data ? { startDate: j.hora ? `${j.data}T${j.hora}:00-03:00` : j.data } : {}),
    ...(jogado(j) ? {} : { eventStatus: "https://schema.org/EventScheduled" }),
    homeTeam: { "@type": "SportsTeam", name: c, url: absoluto(U.time(c)) }, awayTeam: { "@type": "SportsTeam", name: f, url: absoluto(U.time(f)) },
    superEvent: { "@type": "SportsEvent", name: liga }, url: absoluto(alt[lg])
  };
  const jsonld = { "@context": "https://schema.org", "@graph": [evento, ldMigalhas(itens)] };
  const lista = tops.map((p) => `<tr><td>${esc(c)} ${p.gc} x ${p.gf} ${esc(f)}</td><td class="c">${num(p.p * 100, 1)}%</td></tr>`).join("");
  const corpo = `<main class="artigo">
${migalhas(itens, raiz)}
<header><span class="eyebrow">${esc(liga)}${j.rodada ? " · " + T("Rodada", "Round") + " " + j.rodada : ""}${j.data ? " · " + dataLonga(j.data) : ""}${j.hora ? " · " + j.hora + T("", " (Brasília time)") : ""}</span><h1>${esc(c)} ${T("x", "vs")} ${esc(f)}: ${T("prognóstico, probabilidades e placar provável", "prediction, probabilities and likely score")}</h1></header>
${jogado(j) ? `<p class="destaque ${fav(j) === res(j) ? "ok" : "bad"}">${esc(textoResultado(j))}</p>` : ""}
<div class="games solo">${cartao(j)}</div>
<section><h2>${T("Quem é o favorito", "Who is the favourite")}</h2><p>${esc(resumoJogo(j))}</p></section>
${secaoContexto(j, raiz)}
<section><h2>${T("Gols esperados", "Expected goals")}</h2><p>${esc(golsJogo(j))}</p></section>
<section><h2>${T("Placares mais prováveis", "Most likely scores")}</h2>
<div class="tablewrap"><table><thead><tr><th>${T("Placar", "Score")}</th><th class="c">${T("Probabilidade", "Probability")}</th></tr></thead><tbody>${lista}</tbody></table></div>
<p class="muted nota">${T("Mesmo o placar mais provável costuma ter menos de 15% de chance. O modelo indica tendências, não resultados certos.", "Even the most likely score usually has less than a 15% chance. The model shows tendencies, not certain results.")}</p></section>
<section><h2>${T("De onde vêm esses números", "Where these numbers come from")}</h2><p>${T("As probabilidades saem de um modelo de gols que compara o ataque e a defesa de cada time com a média da liga, na campanha geral e em casa ou fora. A tabela, a sequência recente e o confronto direto aparecem como contexto e não entram no cálculo.",
    "The probabilities come from a goals model that compares each team's attack and defence with the league average, across the whole season and at home or away. The table, recent form and head-to-head are shown as context and are not part of the calculation.")} <a href="${raiz}${U.metodo()}">${T("Veja como o modelo funciona", "See how the model works")}</a>.</p></section>
<p class="relacionados">${T("Mais sobre os times", "More on these teams")}: <a href="${raiz}${U.time(c)}">${esc(c)}</a> · <a href="${raiz}${U.time(f)}">${esc(f)}</a>${j.rodada ? ` · <a href="${raiz}${U.rodada(liga, j.rodada)}">${T(`todos os jogos da rodada ${j.rodada}`, `all round ${j.rodada} matches`)}</a>` : ""}</p>
</main>`;
  return pagina({ titulo, descricao, alt, corpo, jsonld, tipo: "article" });
}

/* ---------- desempenho ---------- */
function desempenho(lista) {
  const feitos = lista.filter(jogado);
  const acertos = feitos.filter((j) => fav(j) === res(j)).length;
  const br = feitos.length ? feitos.reduce((s, j) => s + brier(j), 0) / feitos.length : null;
  const o25 = feitos.filter((j) => (j.o25 >= 0.5) === (j.gc + j.gf > 2)).length;
  return { feitos, acertos, br, o25 };
}
function blocoDesempenho(d) {
  const n = d.feitos.length;
  return `<div class="stats">
<div class="stat"><b>${n}</b><span>${T("previsões avaliadas", "predictions scored")}</span></div>
<div class="stat"><b>${n ? Math.round(d.acertos / n * 100) + "%" : "—"}</b><span>${T("favorito do modelo venceu", "model's favourite won")}${n ? T(` (${d.acertos} de ${n})`, ` (${d.acertos} of ${n})`) : ""}</span></div>
<div class="stat"><b>${d.br === null ? "—" : num(d.br, 3)}</b><span>${T("Brier score (menor é melhor)", "Brier score (lower is better)")}</span></div>
<div class="stat"><b>${n ? Math.round(d.o25 / n * 100) + "%" : "—"}</b><span>${T("acerto em mais/menos de 2,5", "over/under 2.5 accuracy")}</span></div>
</div>`;
}
function tabelaResultados(lista, raiz) {
  return `<div class="tablewrap"><table><thead><tr><th>${T("Data", "Date")}</th><th>${T("Jogo", "Match")}</th><th class="c">${T("Placar", "Score")}</th><th>${T("Favorito do modelo", "Model's favourite")}</th><th class="c">${T("Casa · Emp · Fora", "Home · Draw · Away")}</th><th class="c"></th></tr></thead><tbody>${
    lista.map((j) => { const ok = fav(j) === res(j); const fn = fav(j) === "1" ? j.casa : fav(j) === "2" ? j.fora : T("Empate", "Draw");
      return `<tr><td>${diaMes(j.data)}</td><td><a href="${raiz}${U.jogo(j)}">${esc(j.casa)} ${T("x", "vs")} ${esc(j.fora)}</a></td><td class="c"><b>${j.gc} – ${j.gf}</b></td><td>${esc(fn)} (${pct(Math.max(j.p1, j.px, j.p2))})</td><td class="c">${pct(j.p1)} · ${pct(j.px)} · ${pct(j.p2)}</td><td class="c"><span class="pill ${ok ? "ok\">" + T("acertou", "hit") : "bad\">" + T("errou", "miss")}</span></td></tr>`; }).join("")
  }</tbody></table></div>`;
}
const link = (j, raiz) => `<a class="cardlink" href="${raiz}${U.jogo(j)}" aria-label="${esc(j.casa)} ${T("x", "vs")} ${esc(j.fora)}: ${T("ver análise", "see analysis")}">${cartao(j)}</a>`;

/* Grade de times: ordenada pela posição na tabela quando conhecida, senão por nome */
function gradeTimes(times, raiz) {
  const ordenados = times.slice().sort((a, b) => (a.tab && b.tab ? a.tab.pos - b.tab.pos : a.tab ? -1 : b.tab ? 1 : a.nome.localeCompare(b.nome, "pt-BR")));
  return `<ul class="grade-times">${ordenados.map((t) => {
    const prox = t.jogos.filter((j) => !jogado(j)).sort((a, b) => ordData(a, b, 1))[0];
    const adv = prox ? (prox.casa === t.nome ? prox.fora : prox.casa) : null;
    const zona = t.tab && t.ref ? (t.tab.pos <= 4 ? "g4" : t.tab.pos >= 17 ? "z4" : "") : "";
    return `<li><a href="${raiz}${U.time(t.nome)}"${zona ? ` class="${zona}"` : ""}>` +
      (t.tab ? `<span class="pos">${ord(t.tab.pos)}</span>` : "") +
      `<span class="nome">${esc(t.nome)}</span>` +
      `<span class="info">${t.tab ? `${t.tab.pts} pts` : ""}${t.tab && adv ? " · " : ""}${adv ? `${T("Próx.", "Next")}: ${esc(adv)} (${prox.casa === t.nome ? T("casa", "home") : T("fora", "away")})` : ""}</span></a></li>`;
  }).join("")}</ul>`;
}

/* Próximos jogos agrupados por rodada, com link para a página de cada rodada */
function proximosPorRodada(pend, raiz) {
  const grupos = new Map();
  pend.forEach((j) => { const k = j.rodada ? `${j.liga}|${j.rodada}` : ""; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(j); });
  const temRodada = [...grupos.keys()].some(Boolean);
  if (!temRodada) return `<div class="games">${pend.map((j) => link(j, raiz)).join("")}</div>`;
  return [...grupos.entries()].sort(([a], [b]) => (a ? 0 : 1) - (b ? 0 : 1)).map(([k, js]) => {
    if (!k) return `<div class="grupo-rodada"><h3>${T("Outros jogos", "Other matches")}</h3><div class="games">${js.map((j) => link(j, raiz)).join("")}</div></div>`;
    const j0 = js[0], url = raiz + U.rodada(j0.liga, j0.rodada);
    return `<div class="grupo-rodada"><div class="grupo-topo"><h3><a href="${url}">${T("Rodada", "Round")} ${j0.rodada}</a></h3><a class="ver-rodada" href="${url}">${T("Ver a rodada completa", "See the full round")} →</a></div><div class="games">${js.map((j) => link(j, raiz)).join("")}</div></div>`;
  }).join("");
}

/* Cartões de rodada: número em destaque, período, quantidade de jogos e situação */
function gradeRodadas(rodadas, raiz) {
  return `<ul class="grade-times grade-rodadas">${rodadas.map((r) => {
    const datas = r.jogos.map((j) => j.data).filter(Boolean).sort();
    const periodo = datas.length ? (datas[0] === datas[datas.length - 1] ? diaMes(datas[0]) : `${diaMes(datas[0])} ${T("a", "to")} ${diaMes(datas[datas.length - 1])}`) : "";
    const abertos = r.jogos.filter((j) => !jogado(j)).length;
    const estado = abertos ? T(`${abertos} a jogar`, `${abertos} to play`) : T("encerrada", "completed");
    return `<li><a href="${raiz}${U.rodada(r.liga, r.n)}"${abertos ? ' class="aberta"' : ""}>` +
      `<span class="nome">${T("Rodada", "Round")} ${r.n} <small>${esc(r.liga.replace(/^Brasileirão\s+/, ""))}</small></span>` +
      `<span class="info">${T(plural(r.jogos.length, "jogo", "jogos"), plural(r.jogos.length, "match", "matches"))}${periodo ? " · " + periodo : ""}</span>` +
      `<span class="info estado">${estado}</span></a></li>`;
  }).join("")}</ul>`;
}

/* ---------- página inicial ---------- */
function paginaInicial(jogos, times, rodadas) {
  const alt = ambos((l) => U.inicio(l)), raiz = raizDe(alt[lg]);
  const pend = jogos.filter((j) => !jogado(j)).sort((a, b) => ordData(a, b, 1));
  const d = desempenho(jogos);
  const feitos = d.feitos.slice().sort((a, b) => ordData(a, b, -1));
  const corpo = `<header><span class="eyebrow">${T("Modelo de gols · Brasileirão", "Goals model · Brazilian league")}${dados.atualizado ? " · " + T("atualizado em", "updated") + " " + dataCurta(dados.atualizado) : ""}</span><h1>${esc(site.nome)}</h1>
<p class="muted">${T("Prognósticos do Brasileirão calculados por um modelo estatístico de gols, com metodologia aberta e histórico público de acertos. Depois de cada jogo, o resultado entra no placar de desempenho abaixo, acerte ou erre.",
    "Match probabilities for Brazil's top football league (Brasileirão), calculated by a statistical goals model with an open methodology and a public track record. After every match, the result goes into the scorecard below, hit or miss.")}</p></header>
<section><h2>${T("Próximos jogos", "Upcoming matches")}</h2>${pend.length ? proximosPorRodada(pend, raiz)
    : `<div class="empty">${T("Nenhuma previsão aberta no momento. As próximas aparecem aqui antes de cada rodada.", "No open predictions right now. New ones appear here before each round.")}</div>`}</section>
${rodadas.length ? `<section><h2>${T("Rodadas", "Rounds")}</h2>${gradeRodadas(rodadas, raiz)}</section>` : ""}
<section><h2>${T("Desempenho até aqui", "Track record so far")}</h2>${blocoDesempenho(d)}
<p class="muted nota">${T("Com poucos jogos, esses números oscilam muito. No teste com 2.280 jogos da Série A de 2019 a 2024, o favorito do modelo venceu em 48,7% das vezes, contra 46,2% de escolher sempre o mandante.",
    "With few matches, these numbers swing a lot. In a test on 2,280 Série A matches from 2019 to 2024, the model's favourite won 48.7% of the time, against 46.2% for always picking the home team.")}</p></section>
<section><h2>${T("Resultados", "Results")}</h2>${feitos.length ? tabelaResultados(feitos, raiz) : `<div class="empty">${T("Os resultados aparecem aqui depois de cada jogo.", "Results appear here after each match.")}</div>`}</section>
<section><h2>${T("Times", "Teams")}</h2>${gradeTimes(times, raiz)}<p class="nota"><a href="${raiz}${U.times()}">${T("Ver a tabela com o próximo jogo de cada time", "See the table with each team's next match")} →</a></p></section>
<section><h2>${T("Como funciona", "How it works")}</h2><p>${T("O modelo estima os gols esperados de cada time a partir do ataque e da defesa, e calcula a chance de cada placar.", "The model estimates each team's expected goals from attack and defence, then works out the chance of every score.")} <a href="${raiz}${U.metodo()}">${T("Leia a metodologia completa", "Read the full methodology")}</a>.</p></section>`;
  const jsonld = { "@context": "https://schema.org", "@type": "WebSite", name: site.nome, url: absoluto(alt[lg]), inLanguage: HTML_LANG[lg], description: descricaoSite() };
  return pagina({ titulo: T(`${site.nome}: prognósticos e probabilidades do Brasileirão`, `${site.nome}: Brazilian league match predictions and probabilities`), descricao: descricaoSite(), alt, corpo, jsonld });
}

/* ---------- times ---------- */
function agruparTimes(jogos) {
  const m = new Map();
  jogos.forEach((j) => [j.casa, j.fora].forEach((nome) => {
    if (!m.has(nome)) m.set(nome, { nome, jogos: [] });
    m.get(nome).jogos.push(j);
  }));
  m.forEach((t) => {
    // Situação mais recente na tabela, vinda do jogo mais novo que tenha contexto
    const comCtx = t.jogos.filter((j) => j.ctx && ((j.casa === t.nome && j.ctx.tc) || (j.fora === t.nome && j.ctx.tf))).sort((a, b) => ordData(a, b, -1))[0];
    if (comCtx) { t.tab = comCtx.casa === t.nome ? comCtx.ctx.tc : comCtx.ctx.tf; t.ref = comCtx.ctx.ref; t.tabData = comCtx.data;
      t.ultimos = comCtx.casa === t.nome ? comCtx.ctx.uc : comCtx.ctx.uf; }
    t.mod = maxData(...t.jogos.map(ultimaMudanca));
  });
  return [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
function paginaTime(t) {
  const alt = ambos((l) => U.time(t.nome, l)), raiz = raizDe(alt[lg]);
  const proximos = t.jogos.filter((j) => !jogado(j)).sort((a, b) => ordData(a, b, 1));
  const d = desempenho(t.jogos);
  const passados = t.jogos.filter(jogado).sort((a, b) => ordData(a, b, -1));
  const itens = [{ nome: T("Início", "Home"), url: U.inicio() }, { nome: T("Times", "Teams"), url: U.times() }, { nome: t.nome, url: alt[lg] }];
  const prox = proximos[0];
  let intro = T(`Previsões do modelo para os jogos do ${t.nome} no Brasileirão, com probabilidade de vitória, empate e derrota, gols esperados e o histórico de acertos.`,
    `The model's predictions for ${t.nome} matches in the Brasileirão, with win, draw and loss probabilities, expected goals and the track record.`);
  if (t.tab) intro = T(`O ${t.nome} é o ${situacao(t.tab, t.ref)}${t.tabData ? ` (dados de ${dataCurta(t.tabData)})` : ""}. `, `${t.nome} are ${situacao(t.tab, t.ref)}${t.tabData ? ` (as of ${dataCurta(t.tabData)})` : ""}. `) + intro;
  let descricao = prox ? T(`Próximo jogo do ${t.nome}: ${prox.casa} x ${prox.fora}${prox.data ? " em " + dataCurta(prox.data) : ""}, com ${pct(prox.casa === t.nome ? prox.p1 : prox.p2)} de chance de vitória do ${t.nome} segundo o modelo.`,
    `${t.nome}'s next match: ${prox.casa} vs ${prox.fora}${prox.data ? " on " + dataCurta(prox.data) : ""}, with a ${pct(prox.casa === t.nome ? prox.p1 : prox.p2)} chance of a ${t.nome} win according to the model.`)
    : T(`Prognósticos e probabilidades dos jogos do ${t.nome} no Brasileirão, com gols esperados e histórico de acertos do modelo.`, `Predictions and probabilities for ${t.nome} matches in the Brasileirão, with expected goals and the model's track record.`);
  if (t.tab) descricao += T(` ${ord(t.tab.pos)} colocado, ${t.tab.pts} pontos.`, ` ${ord(t.tab.pos)} place, ${t.tab.pts} points.`);
  const corpo = `<main class="artigo">
${migalhas(itens, raiz)}
<header><span class="eyebrow">${T("Time", "Team")}</span><h1>${esc(t.nome)}: ${T("próximo jogo, prognóstico e probabilidades", "next match, prediction and probabilities")}</h1><p>${esc(intro)}</p></header>
${t.ultimos && t.ultimos.length ? `<section><h2>${T("Últimos jogos", "Recent matches")}</h2><p>${forma(t.ultimos)}</p><p class="muted nota">${esc(T(`${contaForma(t.ultimos)} nos últimos ${t.ultimos.length} jogos, em todas as competições, mais recente à esquerda.`, `${contaForma(t.ultimos)} in the last ${t.ultimos.length} matches, all competitions, most recent on the left.`))}</p></section>` : ""}
<section><h2>${proximos.length > 1 ? T("Próximos jogos", "Upcoming matches") : T("Próximo jogo", "Next match")}</h2>${proximos.length ? `<div class="games">${proximos.map((j) => link(j, raiz)).join("")}</div>`
    : `<div class="empty">${T(`Nenhuma previsão aberta para o ${esc(t.nome)} no momento.`, `No open predictions for ${esc(t.nome)} right now.`)}</div>`}</section>
<section><h2>${T(`Desempenho do modelo nos jogos do ${esc(t.nome)}`, `Model track record in ${esc(t.nome)} matches`)}</h2>${blocoDesempenho(d)}</section>
${passados.length ? `<section><h2>${T("Jogos analisados", "Matches analysed")}</h2>${tabelaResultados(passados, raiz)}</section>` : ""}
<p class="relacionados"><a href="${raiz}${U.times()}">← ${T("Todos os times", "All teams")}</a></p>
</main>`;
  const jsonld = { "@context": "https://schema.org", "@graph": [{ "@type": "SportsTeam", name: t.nome, sport: T("Futebol", "Football"), url: absoluto(alt[lg]) }, ldMigalhas(itens)] };
  return pagina({ titulo: T(`${t.nome}: próximo jogo e prognóstico | ${site.nome}`, `${t.nome}: next match and prediction | ${site.nome}`), descricao, alt, corpo, jsonld });
}
function paginaTimes(times) {
  const alt = ambos((l) => U.times(l)), raiz = raizDe(alt[lg]);
  const itens = [{ nome: T("Início", "Home"), url: U.inicio() }, { nome: T("Times", "Teams"), url: alt[lg] }];
  const comPos = times.filter((t) => t.tab).sort((a, b) => a.tab.pos - b.tab.pos);
  const semPos = times.filter((t) => !t.tab);
  const linhas = comPos.concat(semPos).map((t) => {
    const prox = t.jogos.filter((j) => !jogado(j)).sort((a, b) => ordData(a, b, 1))[0];
    return `<tr><td class="c">${t.tab ? t.tab.pos : "—"}</td><td><a href="${raiz}${U.time(t.nome)}">${esc(t.nome)}</a></td><td class="c">${t.tab ? t.tab.pts : "—"}</td><td>${prox ? `<a href="${raiz}${U.jogo(prox)}">${esc(prox.casa)} ${T("x", "vs")} ${esc(prox.fora)}</a> (${diaMes(prox.data)})` : '<span class="muted">—</span>'}</td></tr>`;
  }).join("");
  const corpo = `<main class="artigo">
${migalhas(itens, raiz)}
<header><span class="eyebrow">Brasileirão</span><h1>${T("Times: próximos jogos e prognósticos", "Teams: upcoming matches and predictions")}</h1><p class="muted">${T("Escolha um time para ver o próximo jogo, as probabilidades calculadas pelo modelo e o histórico de previsões. A posição e os pontos vêm do jogo mais recente analisado de cada time.",
    "Pick a team to see its next match, the model's probabilities and its prediction history. Position and points come from each team's most recent analysed match.")}</p></header>
<div class="tablewrap"><table><thead><tr><th class="c">${T("Pos.", "Pos.")}</th><th>${T("Time", "Team")}</th><th class="c">Pts</th><th>${T("Próximo jogo analisado", "Next analysed match")}</th></tr></thead><tbody>${linhas}</tbody></table></div>
</main>`;
  return pagina({ titulo: T(`Times do Brasileirão: próximos jogos e prognósticos | ${site.nome}`, `Brasileirão teams: upcoming matches and predictions | ${site.nome}`),
    descricao: T("Próximo jogo e prognóstico de cada time do Brasileirão, com probabilidades de vitória, empate e derrota calculadas por um modelo estatístico de gols.",
      "Next match and prediction for every Brasileirão team, with win, draw and loss probabilities from a statistical goals model."),
    alt, corpo, jsonld: { "@context": "https://schema.org", ...ldMigalhas(itens) } });
}

/* ---------- rodadas ---------- */
function agruparRodadas(jogos) {
  const m = new Map();
  jogos.filter((j) => j.rodada).forEach((j) => {
    const k = `${j.liga}|${j.rodada}`;
    if (!m.has(k)) m.set(k, { liga: j.liga, n: j.rodada, jogos: [] });
    m.get(k).jogos.push(j);
  });
  return [...m.values()].sort((a, b) => a.liga.localeCompare(b.liga) || b.n - a.n);
}
function paginaRodada(r) {
  const alt = ambos((l) => U.rodada(r.liga, r.n, l)), raiz = raizDe(alt[lg]);
  const js = r.jogos.slice().sort((a, b) => ordData(a, b, 1));
  const itens = [{ nome: T("Início", "Home"), url: U.inicio() }, { nome: T(`${r.liga}, rodada ${r.n}`, `${r.liga}, round ${r.n}`), url: alt[lg] }];
  const pend = js.filter((j) => !jogado(j)), feitos = js.filter(jogado);
  const datas = js.map((j) => j.data).filter(Boolean).sort();
  const periodo = datas.length ? (datas[0] === datas[datas.length - 1] ? T(` em ${dataCurta(datas[0])}`, ` on ${dataCurta(datas[0])}`)
    : T(` de ${diaMes(datas[0])} a ${dataCurta(datas[datas.length - 1])}`, ` from ${diaMes(datas[0])} to ${dataCurta(datas[datas.length - 1])}`)) : "";
  const corpo = `<main class="artigo">
${migalhas(itens, raiz)}
<header><span class="eyebrow">${esc(r.liga)}</span><h1>${T(`Rodada ${r.n} do ${esc(r.liga)}: prognósticos e probabilidades`, `${esc(r.liga)} round ${r.n}: predictions and probabilities`)}</h1><p class="muted">${esc(T(`${plural(js.length, "jogo analisado", "jogos analisados")}${periodo}. Clique num jogo para ver o contexto, os gols esperados e os placares mais prováveis.`,
    `${plural(js.length, "match", "matches")} analysed${periodo}. Pick a match to see the context, expected goals and most likely scores.`))}</p></header>
${pend.length ? `<section><h2>${T("Jogos", "Matches")}</h2><div class="games">${pend.map((j) => link(j, raiz)).join("")}</div></section>` : ""}
${feitos.length ? `<section><h2>${T("Resultados", "Results")}</h2>${tabelaResultados(feitos, raiz)}</section>` : ""}
</main>`;
  return pagina({ titulo: T(`Rodada ${r.n} do ${r.liga}: prognósticos e probabilidades | ${site.nome}`, `${r.liga} round ${r.n}: predictions and probabilities | ${site.nome}`),
    descricao: T(`Probabilidades de vitória, empate e placar provável de todos os jogos analisados da rodada ${r.n} do ${r.liga}${periodo}.`,
      `Win, draw and likely-score probabilities for every analysed match in ${r.liga} round ${r.n}${periodo}.`),
    alt, corpo, jsonld: { "@context": "https://schema.org", ...ldMigalhas(itens) } });
}

/* ---------- metodologia ---------- */
function paginaMetodo() {
  const alt = ambos((l) => U.metodo(l)), raiz = raizDe(alt[lg]);
  const itens = [{ nome: T("Início", "Home"), url: U.inicio() }, { nome: T("Como funciona", "How it works"), url: alt[lg] }];
  const corpo = lg === "en" ? `<main class="artigo">
${migalhas(itens, raiz)}
<header><span class="eyebrow">Methodology</span><h1>How the model calculates the probabilities</h1></header>
<section><h2>The idea</h2><p>Football is a low-scoring game, and the number of goals a team scores in a match closely follows a Poisson distribution. If we know how many goals each team should score on average in that match, we can work out the chance of every score and, by adding scores up, the chance of a win, a draw, more than 2.5 goals and both teams scoring.</p></section>
<section><h2>Expected goals</h2><ul>
<li>For each team, we measure attacking strength (goals scored) and defensive strength (goals conceded) relative to the league average.</li>
<li>We do this twice: over the whole season and over home matches only (for the home side) or away matches only (for the visitors), then average the two. The whole season has more matches and is steadier; the home/away split captures teams that are much stronger at home.</li>
<li>The home side's expected goals combine its attack with the visitors' defence, and vice versa.</li></ul></section>
<section><h2>The Dixon-Coles adjustment</h2><p>A plain Poisson distribution is slightly off for low scores (0-0, 1-0, 0-1, 1-1). We apply the correction proposed by Dixon and Coles in 1997, used in many football models.</p></section>
<section><h2>Testing on past matches</h2><p>Before publishing, we tested a full version of the model on 2,280 Série A matches from 2019 to 2024, predicting each one using only data from before it.</p>
<div class="tablewrap"><table><thead><tr><th>Method</th><th class="c">Result accuracy</th></tr></thead><tbody>
<tr><td>This model</td><td class="c"><b>48.7%</b></td></tr><tr><td>Always pick the home team</td><td class="c">46.2%</td></tr><tr><td>Historical league average</td><td class="c">46.2%</td></tr></tbody></table></div>
<p>When the favourite had 60% or more, it won 66% of the time. The probabilities were also well calibrated: when the model says 30%, the outcome happens close to 30% of the time.</p></section>
<section><h2>What the model does not do</h2><ul>
<li>It does not know about injuries, suspensions, rotated line-ups or coaching changes.</li>
<li>It does not use the table, recent form or head-to-head in the calculation. Those appear on match pages as context only.</li>
<li>It does not guarantee results. No football model gets close to 90% right; draws happen in about 27% of matches and are almost never the most likely outcome.</li>
<li>It is not a recommendation of any kind: it is a statistical estimate, with the uncertainty every estimate carries.</li></ul></section>
<p><a href="${raiz}${U.inicio()}">← See the predictions</a></p>
</main>` : `<main class="artigo">
${migalhas(itens, raiz)}
<header><span class="eyebrow">Metodologia</span><h1>Como o modelo calcula as probabilidades</h1></header>
<section><h2>A ideia</h2><p>Futebol tem poucos gols, e o número de gols de um time numa partida segue de perto uma distribuição de Poisson. Se sabemos quantos gols cada time deve marcar em média naquele jogo, dá para calcular a chance de cada placar e, somando os placares, a chance de vitória, empate, mais de 2,5 gols e ambas marcam.</p></section>
<section><h2>Os gols esperados</h2><ul>
<li>Para cada time, medimos a força de ataque (gols marcados) e de defesa (gols sofridos) em relação à média da liga.</li>
<li>Fazemos isso duas vezes: na campanha geral e na campanha só em casa (mandante) ou só fora (visitante), e usamos a média das duas leituras. A campanha geral tem mais jogos e é mais estável; a de mando captura quem rende muito mais em casa.</li>
<li>Os gols esperados do mandante combinam o ataque dele com a defesa do visitante, e vice-versa.</li></ul></section>
<section><h2>O ajuste de Dixon-Coles</h2><p>A distribuição de Poisson pura erra um pouco nos placares baixos (0 x 0, 1 x 0, 0 x 1, 1 x 1). Aplicamos a correção proposta por Dixon e Coles em 1997, usada em boa parte dos modelos de futebol.</p></section>
<section><h2>Teste com jogos passados</h2><p>Antes de publicar, testamos uma versão completa do modelo em 2.280 jogos da Série A de 2019 a 2024, prevendo cada partida só com dados anteriores a ela.</p>
<div class="tablewrap"><table><thead><tr><th>Método</th><th class="c">Acerto do resultado</th></tr></thead><tbody>
<tr><td>Este modelo</td><td class="c"><b>48,7%</b></td></tr><tr><td>Escolher sempre o mandante</td><td class="c">46,2%</td></tr><tr><td>Média histórica da liga</td><td class="c">46,2%</td></tr></tbody></table></div>
<p>Nos jogos em que o favorito tinha 60% ou mais, ele venceu em 66% das vezes. As probabilidades também se mostraram bem calibradas: quando o modelo diz 30%, o resultado acontece perto de 30% das vezes.</p></section>
<section><h2>O que o modelo não faz</h2><ul>
<li>Não sabe de lesões, suspensões, escalação reserva ou troca de técnico.</li>
<li>Não usa a tabela, a sequência recente nem o confronto direto no cálculo. Esses dados aparecem nas páginas de jogo só como contexto.</li>
<li>Não garante resultado. Nenhum modelo de futebol acerta perto de 90%; o empate acontece em cerca de 27% dos jogos e quase nunca é o resultado mais provável.</li>
<li>Não é recomendação de nenhum tipo: é uma estimativa estatística, com a incerteza que toda estimativa tem.</li></ul></section>
<p><a href="${raiz}${U.inicio()}">← Ver as previsões</a></p>
</main>`;
  return pagina({ titulo: T(`Como funciona o modelo | ${site.nome}`, `How the model works | ${site.nome}`),
    descricao: T("Metodologia do Placar Provável: modelo de Poisson com ajuste Dixon-Coles, gols esperados por ataque e defesa, e teste em 2.280 jogos do Brasileirão.",
      "Placar Provável methodology: a Poisson model with the Dixon-Coles adjustment, expected goals from attack and defence, tested on 2,280 Brasileirão matches."),
    alt, corpo, tipo: "article", jsonld: { "@context": "https://schema.org", ...ldMigalhas(itens) } });
}

/* ---------- gerar ---------- */
fs.rmSync(SAIDA, { recursive: true, force: true });
fs.mkdirSync(SAIDA, { recursive: true });
["estilo.css", "comum.js", "modelo.js", "admin.html", "og.png", "favicon.svg", ".nojekyll"].forEach(copiar);
escrever("dados/jogos.json", fs.readFileSync(ARQ_DADOS, "utf8"));

const jogos = dados.jogos.map((j) => Object.assign({}, j, { casa: nomeTime(j.casa), fora: nomeTime(j.fora), liga: nomeLiga(j.liga) }));
const times = agruparTimes(jogos);
const rodadas = agruparRodadas(jogos);
const geral = dados.atualizado || hoje;
const urls = [];
const registrar = (alt, mod) => LANGS.forEach((l) => urls.push({ loc: absoluto(alt[l]), mod, alt }));

for (const l of LANGS) {
  lg = l;
  escrever(arquivo(U.inicio()), paginaInicial(jogos, times, rodadas));
  escrever(U.metodo(), paginaMetodo());
  escrever(U.times(), paginaTimes(times));
  jogos.forEach((j) => escrever(U.jogo(j), paginaJogo(j)));
  times.forEach((t) => escrever(U.time(t.nome), paginaTime(t)));
  rodadas.forEach((r) => escrever(U.rodada(r.liga, r.n), paginaRodada(r)));
}
lg = "pt";
registrar(ambos((l) => U.inicio(l)), geral);
registrar(ambos((l) => U.times(l)), geral);
registrar(ambos((l) => U.metodo(l)), geral);
jogos.forEach((j) => registrar(ambos((l) => U.jogo(j, l)), ultimaMudanca(j)));
times.forEach((t) => registrar(ambos((l) => U.time(t.nome, l)), t.mod || geral));
rodadas.forEach((r) => registrar(ambos((l) => U.rodada(r.liga, r.n, l)), maxData(...r.jogos.map(ultimaMudanca))));

// 404 único (o GitHub Pages serve um só), bilíngue
escrever("404.html", pagina({ titulo: `Página não encontrada · Page not found | ${site.nome}`, descricao: site.descricao, alt: { pt: "404.html", en: "404.html" }, noindex: true,
  corpo: `<main class="artigo"><h1>Página não encontrada</h1><p>Esse endereço não existe ou o jogo foi removido. <a href="${BASE}/">Ver todas as previsões</a>.</p>
<p lang="en"><b>Page not found.</b> This address does not exist or the match was removed. <a href="${BASE}/en/">See all predictions</a>.</p></main>` }));

escrever("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.mod}</lastmod><xhtml:link rel="alternate" hreflang="pt-BR" href="${absoluto(u.alt.pt)}"/><xhtml:link rel="alternate" hreflang="en" href="${absoluto(u.alt.en)}"/></url>`).join("\n")}
</urlset>
`);
const prefixo = new URL(BASE + "/").pathname;
escrever("robots.txt", `User-agent: *\nDisallow: ${prefixo}admin.html\n\nSitemap: ${BASE}/sitemap.xml\n`);

console.log(`Site gerado em _site/ (PT + EN): ${jogos.length} jogos (${jogos.filter(jogado).length} com resultado), ${times.length} times, ${rodadas.length} rodadas, ${urls.length} URLs no sitemap.`);
