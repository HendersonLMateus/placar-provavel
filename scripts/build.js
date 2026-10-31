/*
 * Gera o site estático em _site/ a partir de dados/jogos.json.
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
const { esc, pct, jogado, fav, res, brier, ordData, cartao, placares } = vmctx;

/* ---------- utilidades ---------- */
const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const LIGAS = { "Brasileirão Série A": "Brasileirão Série A", "Serie A": "Brasileirão Série A", "Serie B": "Brasileirão Série B", "Serie C": "Brasileirão Série C" };
const nomeLiga = (l) => LIGAS[l] || l || "Brasileirão";
const dataLonga = (d) => { if (!d) return ""; const [a, m, dd] = d.split("-"); return `${+dd} de ${MESES[+m - 1]} de ${a}`; };
const dataCurta = (d) => { if (!d) return ""; const [a, m, dd] = d.split("-"); return `${dd}/${m}/${a}`; };
const diaMes = (d) => (d ? dataCurta(d).slice(0, 5) : "—");
const num = (x, c = 2) => x.toFixed(c).replace(".", ",");
const slugify = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// Nomes do Primatips vêm com a UF ("Bahia BA") ou já em português ("Atlético-MG"). nomes.json traz a grafia
// usada no site e desfaz ambiguidades (Atlético-MG x Athletico-PR); os demais perdem só a sigla do estado.
const NOMES = fs.existsSync(path.join(RAIZ, "nomes.json")) ? JSON.parse(fs.readFileSync(path.join(RAIZ, "nomes.json"), "utf8")) : {};
const nomeTime = (t) => NOMES[t] || String(t || "").replace(/\s+[A-Z]{2}$/, "");
const slugJogo = (j) => `${slugify(j.casa)}-x-${slugify(j.fora)}${j.data ? "-" + j.data : "-" + j.id}`;
const urlJogo = (j) => `jogos/${slugJogo(j)}.html`;
const urlTime = (t) => `times/${slugify(t)}.html`;
const slugLiga = (l) => slugify(l.replace(/^Brasileirão\s+/, ""));
const urlRodada = (liga, n) => `rodadas/${slugLiga(liga)}-rodada-${n}.html`;
const hoje = new Date().toISOString().slice(0, 10);
const maxData = (...ds) => ds.filter(Boolean).sort().pop();

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
  return `<nav class="migalhas" aria-label="Você está em"><ol>${itens.map((it, i) =>
    i === itens.length - 1 ? `<li aria-current="page">${esc(it.nome)}</li>` : `<li><a href="${raiz}${it.url}">${esc(it.nome)}</a></li>`).join("")}</ol></nav>`;
}
function ldMigalhas(itens) {
  return { "@type": "BreadcrumbList", itemListElement: itens.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.nome, item: `${BASE}/${it.url}` })) };
}

function pagina({ titulo, descricao, caminho, raiz, corpo, jsonld, tipo = "website", noindex = false }) {
  const canon = BASE + "/" + (caminho === "index.html" ? "" : caminho);
  const atual = (c) => (caminho === c ? ' aria-current="page"' : "");
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descricao)}">
${site.goatcounter && !noindex ? `<script data-goatcounter="${esc(site.goatcounter)}" async src="https://gc.zgo.at/count.js"></script>` : ""}
${site.googleVerificacao ? `<meta name="google-site-verification" content="${esc(site.googleVerificacao)}">` : ""}
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${canon}">`}
<meta property="og:type" content="${tipo}">
<meta property="og:site_name" content="${esc(site.nome)}">
<meta property="og:locale" content="pt_BR">
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
<nav class="topo" aria-label="Principal"><a class="marca" href="${raiz}">${esc(site.nome)}</a><span><a href="${raiz}"${atual("index.html")}>Previsões</a><a href="${raiz}times.html"${atual("times.html")}>Times</a><a href="${raiz}como-funciona.html"${atual("como-funciona.html")}>Como funciona</a></span></nav>
${corpo}
<footer class="aviso"><p>O Placar Provável é um projeto de estatística aplicada ao futebol. As probabilidades vêm de um modelo matemático de gols, calculado com dados públicos das partidas, e mostram tendências, não certezas: um resultado com 60% de chance deixa de acontecer em 4 de cada 10 jogos. Erros e acertos ficam registrados no histórico do modelo.${caminho === "como-funciona.html" ? "" : ` <a href="${raiz}como-funciona.html">Veja como o modelo funciona</a>.`}</p></footer>
</div>
</body>
</html>
`;
}

/* ---------- textos ---------- */
const ord = (n) => `${n}º`;
function resumoJogo(j) {
  const c = j.casa, f = j.fora, F = fav(j);
  let t;
  if (F === "1") t = `O modelo aponta o ${c} como favorito jogando em casa, com ${pct(j.p1)} de chance de vitória, contra ${pct(j.p2)} do ${f} e ${pct(j.px)} de empate.`;
  else if (F === "2") t = `O modelo aponta o ${f} como favorito mesmo fora de casa, com ${pct(j.p2)} de chance de vitória, contra ${pct(j.p1)} do ${c} e ${pct(j.px)} de empate.`;
  else t = `O modelo vê um jogo equilibrado, com o empate como resultado mais provável (${pct(j.px)}), contra ${pct(j.p1)} do ${c} e ${pct(j.p2)} do ${f}.`;
  if (F !== "X" && Math.abs(j.p1 - j.p2) < 0.1) t += " A diferença entre os dois lados é pequena, então o favoritismo é leve.";
  return t;
}
function golsJogo(j) {
  const tot = j.xgc + j.xgf;
  const ritmo = tot >= 2.9 ? "acima da média do campeonato" : tot <= 2.3 ? "abaixo da média do campeonato" : "perto da média do campeonato";
  return `A expectativa é de ${num(j.xgc)} gol para o ${j.casa} e ${num(j.xgf)} para o ${j.fora}, num total de ${num(tot, 1)} gols, ${ritmo}. ` +
    `Isso dá ${pct(j.o25)} de chance de mais de 2,5 gols e ${pct(j.bts)} de os dois times marcarem.`;
}
function textoResultado(j) {
  const r = `${j.casa} ${j.gc} x ${j.gf} ${j.fora}`;
  const quem = fav(j) === "1" ? j.casa : fav(j) === "2" ? j.fora : "o empate";
  const pr = { "1": j.p1, "X": j.px, "2": j.p2 }[res(j)];
  return fav(j) === res(j) ? `Resultado final: ${r}. O favorito do modelo (${quem}) confirmou a previsão.`
    : `Resultado final: ${r}. O modelo apontava ${quem}; o resultado que aconteceu tinha ${pct(pr)} de probabilidade. Previsões erradas continuam no histórico, junto com as certas.`;
}
// Situação na tabela em linguagem simples ("8º colocado, com 46 pontos, a 8 do G-4")
function situacao(t, ref) {
  let s = `${ord(t.pos)} colocado, com ${t.pts} pontos em ${t.j} jogos`;
  if (!ref) return s;
  if (t.pos === 1) s += ", na liderança";
  else if (t.pos <= 4) s += ref.lider - t.pts <= 6 ? `, a ${ref.lider - t.pts} ponto${ref.lider - t.pts === 1 ? "" : "s"} do líder` : ", no G-4";
  else if (t.pos <= 6) s += `, a ${ref.g4 - t.pts} ponto${ref.g4 - t.pts === 1 ? "" : "s"} do G-4`;
  else if (t.pos >= 17) s += ", na zona de rebaixamento";
  else if (t.pts - ref.z4 <= 6) s += `, ${t.pts - ref.z4} ponto${t.pts - ref.z4 === 1 ? "" : "s"} acima da zona de rebaixamento`;
  else if (ref.g6 - t.pts <= 6) s += `, a ${ref.g6 - t.pts} ponto${ref.g6 - t.pts === 1 ? "" : "s"} do G-6`;
  return s;
}
const contaForma = (u) => { const v = u.filter((x) => x.r === "V").length, e = u.filter((x) => x.r === "E").length; return `${v} vitória${v === 1 ? "" : "s"}, ${e} empate${e === 1 ? "" : "s"} e ${u.length - v - e} derrota${u.length - v - e === 1 ? "" : "s"}`; };
const camp = (a) => `${a[0]} vitória${a[0] === 1 ? "" : "s"}, ${a[1]} empate${a[1] === 1 ? "" : "s"} e ${a[2]} derrota${a[2] === 1 ? "" : "s"}`;
const forma = (u) => `<span class="forma" aria-label="${esc(contaForma(u))}">${u.map((x) => `<i class="r${x.r}" title="${esc(`${x.m === "c" ? "Em casa" : "Fora"} contra ${nomeTime(x.adv)}: ${x.gp} x ${x.gs}`)}">${x.r}</i>`).join("")}</span>`;

function secaoContexto(j, raiz) {
  const x = j.ctx;
  if (!x) return "";
  const c = j.casa, f = j.fora, partes = [];
  if (x.tc || x.tf) {
    const frases = [];
    if (x.tc) frases.push(`O ${c} é o ${situacao(x.tc, x.ref)}.`);
    if (x.tf) frases.push(`O ${f} é o ${situacao(x.tf, x.ref)}.`);
    partes.push(`<section><h2>Situação na tabela</h2><p>${esc(frases.join(" "))}</p></section>`);
  }
  if (x.uc || x.uf || x.cc) {
    let h = `<section><h2>Momento dos times</h2>`;
    const linhas = [];
    if (x.uc && x.uc.length) linhas.push(`<tr><td><a href="${raiz}${urlTime(c)}">${esc(c)}</a></td><td>${forma(x.uc)}</td></tr>`);
    if (x.uf && x.uf.length) linhas.push(`<tr><td><a href="${raiz}${urlTime(f)}">${esc(f)}</a></td><td>${forma(x.uf)}</td></tr>`);
    if (linhas.length) h += `<div class="tablewrap"><table><thead><tr><th>Time</th><th>Últimos 5 jogos</th></tr></thead><tbody>${linhas.join("")}</tbody></table></div>`;
    const frases = [];
    if (x.uc && x.uc.length) frases.push(`Nos últimos ${x.uc.length} jogos, o ${c} somou ${contaForma(x.uc)}.`);
    if (x.uf && x.uf.length) frases.push(`O ${f} tem ${contaForma(x.uf)} no mesmo período.`);
    if (x.cc) frases.push(`Jogando em casa no campeonato, o ${c} tem ${camp(x.cc)}.`);
    if (x.cf) frases.push(`Fora de casa, o ${f} tem ${camp(x.cf)}.`);
    if (frases.length) h += `<p>${esc(frases.join(" "))}</p>`;
    h += `<p class="muted nota">Mais recente à esquerda. A sequência inclui todas as competições.</p></section>`;
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
    partes.push(`<section><h2>Confronto direto</h2><p>${esc(`Nos últimos ${x.h2h.length} encontros, o ${c} venceu ${vc}, o ${f} venceu ${vf} e houve ${e} empate${e === 1 ? "" : "s"}.`)}</p>
<div class="tablewrap"><table><thead><tr><th>Data</th><th>Jogo</th></tr></thead><tbody>${linhas}</tbody></table></div></section>`);
  }
  return partes.join("\n");
}

/* ---------- página de jogo ---------- */
function paginaJogo(j) {
  const c = j.casa, f = j.fora, liga = j.liga;
  const tops = placares(j.xgc, j.xgf, 5);
  const quando = j.data ? ` (${diaMes(j.data)})` : "";
  const titulo = `${c} x ${f}${quando}: prognóstico e probabilidades`;
  let descricao = `${c} x ${f} pelo ${liga}${j.data ? " em " + dataLonga(j.data) : ""}: ${pct(j.p1)} vitória do ${c}, ${pct(j.px)} empate, ${pct(j.p2)} vitória do ${f}. Placar mais provável ${tops[0].gc} x ${tops[0].gf}.`;
  if (j.ctx && j.ctx.tc && j.ctx.tf) descricao += ` ${ord(j.ctx.tc.pos)} contra ${ord(j.ctx.tf.pos)} na tabela.`;
  const itens = [{ nome: "Início", url: "" }];
  if (j.rodada) itens.push({ nome: `Rodada ${j.rodada}`, url: urlRodada(liga, j.rodada) });
  itens.push({ nome: `${c} x ${f}`, url: urlJogo(j) });
  const evento = {
    "@type": "SportsEvent", name: `${c} x ${f}`, sport: "Futebol", description: descricao,
    ...(j.data ? { startDate: j.hora ? `${j.data}T${j.hora}:00-03:00` : j.data } : {}),
    ...(jogado(j) ? {} : { eventStatus: "https://schema.org/EventScheduled" }),
    homeTeam: { "@type": "SportsTeam", name: c, url: `${BASE}/${urlTime(c)}` }, awayTeam: { "@type": "SportsTeam", name: f, url: `${BASE}/${urlTime(f)}` },
    superEvent: { "@type": "SportsEvent", name: liga }, url: `${BASE}/${urlJogo(j)}`
  };
  const jsonld = { "@context": "https://schema.org", "@graph": [evento, ldMigalhas(itens)] };
  const lista = tops.map((p) => `<tr><td>${esc(c)} ${p.gc} x ${p.gf} ${esc(f)}</td><td class="c">${num(p.p * 100, 1)}%</td></tr>`).join("");
  const corpo = `<main class="artigo">
${migalhas(itens, "../")}
<header><span class="eyebrow">${esc(liga)}${j.rodada ? " · Rodada " + j.rodada : ""}${j.data ? " · " + dataLonga(j.data) : ""}${j.hora ? " · " + j.hora : ""}</span><h1>${esc(c)} x ${esc(f)}: prognóstico, probabilidades e placar provável</h1></header>
${jogado(j) ? `<p class="destaque ${fav(j) === res(j) ? "ok" : "bad"}">${esc(textoResultado(j))}</p>` : ""}
<div class="games solo">${cartao(j)}</div>
<section><h2>Quem é o favorito</h2><p>${esc(resumoJogo(j))}</p></section>
${secaoContexto(j, "../")}
<section><h2>Gols esperados</h2><p>${esc(golsJogo(j))}</p></section>
<section><h2>Placares mais prováveis</h2>
<div class="tablewrap"><table><thead><tr><th>Placar</th><th class="c">Probabilidade</th></tr></thead><tbody>${lista}</tbody></table></div>
<p class="muted nota">Mesmo o placar mais provável costuma ter menos de 15% de chance. O modelo indica tendências, não resultados certos.</p></section>
<section><h2>De onde vêm esses números</h2><p>As probabilidades saem de um modelo de gols que compara o ataque e a defesa de cada time com a média da liga, na campanha geral e em casa ou fora. A tabela, a sequência recente e o confronto direto aparecem como contexto e não entram no cálculo. <a href="../como-funciona.html">Veja como o modelo funciona</a>.</p></section>
<p class="relacionados">Mais sobre os times: <a href="../${urlTime(c)}">${esc(c)}</a> · <a href="../${urlTime(f)}">${esc(f)}</a>${j.rodada ? ` · <a href="../${urlRodada(liga, j.rodada)}">todos os jogos da rodada ${j.rodada}</a>` : ""}</p>
</main>`;
  return pagina({ titulo, descricao, caminho: urlJogo(j), raiz: "../", corpo, jsonld, tipo: "article" });
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
<div class="stat"><b>${n}</b><span>previsões avaliadas</span></div>
<div class="stat"><b>${n ? Math.round(d.acertos / n * 100) + "%" : "—"}</b><span>favorito do modelo venceu${n ? ` (${d.acertos} de ${n})` : ""}</span></div>
<div class="stat"><b>${d.br === null ? "—" : num(d.br, 3)}</b><span>Brier score (menor é melhor)</span></div>
<div class="stat"><b>${n ? Math.round(d.o25 / n * 100) + "%" : "—"}</b><span>acerto em mais/menos de 2,5</span></div>
</div>`;
}
function tabelaResultados(lista, raiz, comSelo = true) {
  return `<div class="tablewrap"><table><thead><tr><th>Data</th><th>Jogo</th><th class="c">Placar</th><th>Favorito do modelo</th><th class="c">Casa · Emp · Fora</th>${comSelo ? '<th class="c"></th>' : ""}</tr></thead><tbody>${
    lista.map((j) => { const ok = fav(j) === res(j); const fn = fav(j) === "1" ? j.casa : fav(j) === "2" ? j.fora : "Empate";
      return `<tr><td>${diaMes(j.data)}</td><td><a href="${raiz}${urlJogo(j)}">${esc(j.casa)} x ${esc(j.fora)}</a></td><td class="c"><b>${j.gc} – ${j.gf}</b></td><td>${esc(fn)} (${pct(Math.max(j.p1, j.px, j.p2))})</td><td class="c">${pct(j.p1)} · ${pct(j.px)} · ${pct(j.p2)}</td>${comSelo ? `<td class="c"><span class="pill ${ok ? "ok\">acertou" : "bad\">errou"}</span></td>` : ""}</tr>`; }).join("")
  }</tbody></table></div>`;
}
const link = (j, raiz) => `<a class="cardlink" href="${raiz}${urlJogo(j)}" aria-label="${esc(j.casa)} x ${esc(j.fora)}: ver análise">${cartao(j)}</a>`;

/* Grade de times: ordenada pela posição na tabela quando conhecida, senão por nome */
function gradeTimes(times, raiz) {
  const ordenados = times.slice().sort((a, b) => (a.tab && b.tab ? a.tab.pos - b.tab.pos : a.tab ? -1 : b.tab ? 1 : a.nome.localeCompare(b.nome, "pt-BR")));
  return `<ul class="grade-times">${ordenados.map((t) => {
    const prox = t.jogos.filter((j) => !jogado(j)).sort((a, b) => ordData(a, b, 1))[0];
    const adv = prox ? (prox.casa === t.nome ? prox.fora : prox.casa) : null;
    const zona = t.tab && t.ref ? (t.tab.pos <= 4 ? "g4" : t.tab.pos >= 17 ? "z4" : "") : "";
    return `<li><a href="${raiz}${urlTime(t.nome)}"${zona ? ` class="${zona}"` : ""}>` +
      (t.tab ? `<span class="pos">${t.tab.pos}º</span>` : "") +
      `<span class="nome">${esc(t.nome)}</span>` +
      `<span class="info">${t.tab ? `${t.tab.pts} pts` : ""}${t.tab && adv ? " · " : ""}${adv ? `Próx.: ${esc(adv)} (${prox.casa === t.nome ? "casa" : "fora"})` : ""}</span></a></li>`;
  }).join("")}</ul>`;
}

/* Próximos jogos agrupados por rodada, com link para a página de cada rodada */
function proximosPorRodada(pend) {
  const grupos = new Map();
  pend.forEach((j) => { const k = j.rodada ? `${j.liga}|${j.rodada}` : ""; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(j); });
  const temRodada = [...grupos.keys()].some(Boolean);
  if (!temRodada) return `<div class="games">${pend.map((j) => link(j, "")).join("")}</div>`;
  return [...grupos.entries()].sort(([a], [b]) => (a ? 0 : 1) - (b ? 0 : 1)).map(([k, js]) => {
    if (!k) return `<div class="grupo-rodada"><h3>Outros jogos</h3><div class="games">${js.map((j) => link(j, "")).join("")}</div></div>`;
    const j0 = js[0], url = urlRodada(j0.liga, j0.rodada);
    return `<div class="grupo-rodada"><div class="grupo-topo"><h3><a href="${url}">Rodada ${j0.rodada}</a></h3><a class="ver-rodada" href="${url}">Ver a rodada completa →</a></div><div class="games">${js.map((j) => link(j, "")).join("")}</div></div>`;
  }).join("");
}

/* Cartões de rodada: número em destaque, período, quantidade de jogos e situação */
function gradeRodadas(rodadas, raiz) {
  return `<ul class="grade-times grade-rodadas">${rodadas.map((r) => {
    const datas = r.jogos.map((j) => j.data).filter(Boolean).sort();
    const periodo = datas.length ? (datas[0] === datas[datas.length - 1] ? diaMes(datas[0]) : `${diaMes(datas[0])} a ${diaMes(datas[datas.length - 1])}`) : "";
    const abertos = r.jogos.filter((j) => !jogado(j)).length;
    const estado = abertos ? `${abertos} a jogar` : "encerrada";
    return `<li><a href="${raiz}${urlRodada(r.liga, r.n)}"${abertos ? ' class="aberta"' : ""}>` +
      `<span class="nome">Rodada ${r.n} <small>${esc(r.liga.replace(/^Brasileirão\s+/, ""))}</small></span>` +
      `<span class="info">${r.jogos.length} jogo${r.jogos.length === 1 ? "" : "s"}${periodo ? " · " + periodo : ""}</span>` +
      `<span class="info estado">${estado}</span></a></li>`;
  }).join("")}</ul>`;
}

/* ---------- página inicial ---------- */
function paginaInicial(jogos, times, rodadas) {
  const pend = jogos.filter((j) => !jogado(j)).sort((a, b) => ordData(a, b, 1));
  const d = desempenho(jogos);
  const feitos = d.feitos.slice().sort((a, b) => ordData(a, b, -1));
  const corpo = `<header><span class="eyebrow">Modelo de gols · Brasileirão${dados.atualizado ? " · atualizado em " + dataCurta(dados.atualizado) : ""}</span><h1>${esc(site.nome)}</h1>
<p class="muted">Prognósticos do Brasileirão calculados por um modelo estatístico de gols, com metodologia aberta e histórico público de acertos. Depois de cada jogo, o resultado entra no placar de desempenho abaixo, acerte ou erre.</p></header>
<section><h2>Próximos jogos</h2>${pend.length ? proximosPorRodada(pend)
    : `<div class="empty">Nenhuma previsão aberta no momento. As próximas aparecem aqui antes de cada rodada.</div>`}</section>
${rodadas.length ? `<section><h2>Rodadas</h2>${gradeRodadas(rodadas, "")}</section>` : ""}
<section><h2>Desempenho até aqui</h2>${blocoDesempenho(d)}
<p class="muted nota">Com poucos jogos, esses números oscilam muito. No teste com 2.280 jogos da Série A de 2019 a 2024, o favorito do modelo venceu em 48,7% das vezes, contra 46,2% de escolher sempre o mandante.</p></section>
<section><h2>Resultados</h2>${feitos.length ? tabelaResultados(feitos, "") : `<div class="empty">Os resultados aparecem aqui depois de cada jogo.</div>`}</section>
<section><h2>Times</h2>${gradeTimes(times, "")}<p class="nota"><a href="times.html">Ver a tabela com o próximo jogo de cada time →</a></p></section>
<section><h2>Como funciona</h2><p>O modelo estima os gols esperados de cada time a partir do ataque e da defesa, e calcula a chance de cada placar. <a href="como-funciona.html">Leia a metodologia completa</a>.</p></section>`;
  const jsonld = { "@context": "https://schema.org", "@type": "WebSite", name: site.nome, url: BASE + "/", inLanguage: "pt-BR", description: site.descricao };
  return pagina({ titulo: `${site.nome}: prognósticos e probabilidades do Brasileirão`, descricao: site.descricao, caminho: "index.html", raiz: "./", corpo, jsonld });
}

/* ---------- times ---------- */
function agruparTimes(jogos) {
  const m = new Map();
  jogos.forEach((j) => [["c", j.casa], ["f", j.fora]].forEach(([lado, nome]) => {
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
  const proximos = t.jogos.filter((j) => !jogado(j)).sort((a, b) => ordData(a, b, 1));
  const d = desempenho(t.jogos);
  const passados = t.jogos.filter(jogado).sort((a, b) => ordData(a, b, -1));
  const itens = [{ nome: "Início", url: "" }, { nome: "Times", url: "times.html" }, { nome: t.nome, url: urlTime(t.nome) }];
  const prox = proximos[0];
  let intro = `Previsões do modelo para os jogos do ${t.nome} no Brasileirão, com probabilidade de vitória, empate e derrota, gols esperados e o histórico de acertos.`;
  if (t.tab) intro = `O ${t.nome} é o ${situacao(t.tab, t.ref)}${t.tabData ? ` (dados de ${dataCurta(t.tabData)})` : ""}. ` + intro;
  let descricao = prox ? `Próximo jogo do ${t.nome}: ${prox.casa} x ${prox.fora}${prox.data ? " em " + dataCurta(prox.data) : ""}, com ${pct(prox.casa === t.nome ? prox.p1 : prox.p2)} de chance de vitória do ${t.nome} segundo o modelo.`
    : `Prognósticos e probabilidades dos jogos do ${t.nome} no Brasileirão, com gols esperados e histórico de acertos do modelo.`;
  if (t.tab) descricao += ` ${ord(t.tab.pos)} colocado, ${t.tab.pts} pontos.`;
  const corpo = `<main class="artigo">
${migalhas(itens, "../")}
<header><span class="eyebrow">Time</span><h1>${esc(t.nome)}: próximo jogo, prognóstico e probabilidades</h1><p>${esc(intro)}</p></header>
${t.ultimos && t.ultimos.length ? `<section><h2>Últimos jogos</h2><p>${forma(t.ultimos)}</p><p class="muted nota">${esc(contaForma(t.ultimos))} nos últimos ${t.ultimos.length} jogos, em todas as competições, mais recente à esquerda.</p></section>` : ""}
<section><h2>${proximos.length > 1 ? "Próximos jogos" : "Próximo jogo"}</h2>${proximos.length ? `<div class="games">${proximos.map((j) => link(j, "../")).join("")}</div>`
    : `<div class="empty">Nenhuma previsão aberta para o ${esc(t.nome)} no momento.</div>`}</section>
<section><h2>Desempenho do modelo nos jogos do ${esc(t.nome)}</h2>${blocoDesempenho(d)}</section>
${passados.length ? `<section><h2>Jogos analisados</h2>${tabelaResultados(passados, "../")}</section>` : ""}
<p class="relacionados"><a href="../times.html">← Todos os times</a></p>
</main>`;
  const jsonld = { "@context": "https://schema.org", "@graph": [{ "@type": "SportsTeam", name: t.nome, sport: "Futebol", url: `${BASE}/${urlTime(t.nome)}` }, ldMigalhas(itens)] };
  return pagina({ titulo: `${t.nome}: próximo jogo e prognóstico | ${site.nome}`, descricao, caminho: urlTime(t.nome), raiz: "../", corpo, jsonld });
}
function paginaTimes(times) {
  const itens = [{ nome: "Início", url: "" }, { nome: "Times", url: "times.html" }];
  const comPos = times.filter((t) => t.tab).sort((a, b) => a.tab.pos - b.tab.pos);
  const semPos = times.filter((t) => !t.tab);
  const linhas = comPos.concat(semPos).map((t) => {
    const prox = t.jogos.filter((j) => !jogado(j)).sort((a, b) => ordData(a, b, 1))[0];
    return `<tr><td class="c">${t.tab ? t.tab.pos : "—"}</td><td><a href="${urlTime(t.nome)}">${esc(t.nome)}</a></td><td class="c">${t.tab ? t.tab.pts : "—"}</td><td>${prox ? `<a href="${urlJogo(prox)}">${esc(prox.casa)} x ${esc(prox.fora)}</a> (${diaMes(prox.data)})` : '<span class="muted">—</span>'}</td></tr>`;
  }).join("");
  const corpo = `<main class="artigo">
${migalhas(itens, "./")}
<header><span class="eyebrow">Brasileirão</span><h1>Times: próximos jogos e prognósticos</h1><p class="muted">Escolha um time para ver o próximo jogo, as probabilidades calculadas pelo modelo e o histórico de previsões. A posição e os pontos vêm do jogo mais recente analisado de cada time.</p></header>
<div class="tablewrap"><table><thead><tr><th class="c">Pos.</th><th>Time</th><th class="c">Pts</th><th>Próximo jogo analisado</th></tr></thead><tbody>${linhas}</tbody></table></div>
</main>`;
  return pagina({ titulo: `Times do Brasileirão: próximos jogos e prognósticos | ${site.nome}`, descricao: "Próximo jogo e prognóstico de cada time do Brasileirão, com probabilidades de vitória, empate e derrota calculadas por um modelo estatístico de gols.", caminho: "times.html", raiz: "./", corpo, jsonld: { "@context": "https://schema.org", ...ldMigalhas(itens) } });
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
  const js = r.jogos.slice().sort((a, b) => ordData(a, b, 1));
  const itens = [{ nome: "Início", url: "" }, { nome: `${r.liga}, rodada ${r.n}`, url: urlRodada(r.liga, r.n) }];
  const pend = js.filter((j) => !jogado(j)), feitos = js.filter(jogado);
  const datas = js.map((j) => j.data).filter(Boolean).sort();
  const periodo = datas.length ? (datas[0] === datas[datas.length - 1] ? ` em ${dataCurta(datas[0])}` : ` de ${dataCurta(datas[0]).slice(0, 5)} a ${dataCurta(datas[datas.length - 1])}`) : "";
  const corpo = `<main class="artigo">
${migalhas(itens, "../")}
<header><span class="eyebrow">${esc(r.liga)}</span><h1>Rodada ${r.n} do ${esc(r.liga)}: prognósticos e probabilidades</h1><p class="muted">${esc(`${js.length} jogo${js.length === 1 ? "" : "s"} analisado${js.length === 1 ? "" : "s"}${periodo}. Clique num jogo para ver o contexto, os gols esperados e os placares mais prováveis.`)}</p></header>
${pend.length ? `<section><h2>Jogos</h2><div class="games">${pend.map((j) => link(j, "../")).join("")}</div></section>` : ""}
${feitos.length ? `<section><h2>Resultados</h2>${tabelaResultados(feitos, "../")}</section>` : ""}
</main>`;
  return pagina({ titulo: `Rodada ${r.n} do ${r.liga}: prognósticos e probabilidades | ${site.nome}`,
    descricao: `Probabilidades de vitória, empate e placar provável de todos os jogos analisados da rodada ${r.n} do ${r.liga}${periodo}.`,
    caminho: urlRodada(r.liga, r.n), raiz: "../", corpo, jsonld: { "@context": "https://schema.org", ...ldMigalhas(itens) } });
}

/* ---------- metodologia ---------- */
function paginaMetodo() {
  const itens = [{ nome: "Início", url: "" }, { nome: "Como funciona", url: "como-funciona.html" }];
  const corpo = `<main class="artigo">
${migalhas(itens, "./")}
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
<p><a href="./">← Ver as previsões</a></p>
</main>`;
  return pagina({ titulo: `Como funciona o modelo | ${site.nome}`, descricao: "Metodologia do Placar Provável: modelo de Poisson com ajuste Dixon-Coles, gols esperados por ataque e defesa, e teste em 2.280 jogos do Brasileirão.", caminho: "como-funciona.html", raiz: "./", corpo, tipo: "article", jsonld: { "@context": "https://schema.org", ...ldMigalhas(itens) } });
}

/* ---------- gerar ---------- */
fs.rmSync(SAIDA, { recursive: true, force: true });
fs.mkdirSync(SAIDA, { recursive: true });
["estilo.css", "comum.js", "modelo.js", "admin.html", "og.png", "favicon.svg", ".nojekyll"].forEach(copiar);
escrever("dados/jogos.json", fs.readFileSync(ARQ_DADOS, "utf8"));

const jogos = dados.jogos.map((j) => Object.assign({}, j, { casa: nomeTime(j.casa), fora: nomeTime(j.fora), liga: nomeLiga(j.liga) }));
const times = agruparTimes(jogos);
const rodadas = agruparRodadas(jogos);

escrever("index.html", paginaInicial(jogos, times, rodadas));
escrever("como-funciona.html", paginaMetodo());
escrever("times.html", paginaTimes(times));
jogos.forEach((j) => escrever(urlJogo(j), paginaJogo(j)));
times.forEach((t) => escrever(urlTime(t.nome), paginaTime(t)));
rodadas.forEach((r) => escrever(urlRodada(r.liga, r.n), paginaRodada(r)));
escrever("404.html", pagina({ titulo: `Página não encontrada | ${site.nome}`, descricao: site.descricao, caminho: "404.html", raiz: BASE + "/", noindex: true,
  corpo: `<main class="artigo"><h1>Página não encontrada</h1><p>Esse endereço não existe ou o jogo foi removido. <a href="${BASE}/">Ver todas as previsões</a>.</p></main>` }));

const geral = dados.atualizado || hoje;
const urls = [{ loc: BASE + "/", mod: geral }, { loc: `${BASE}/times.html`, mod: geral }, { loc: `${BASE}/como-funciona.html`, mod: geral }]
  .concat(jogos.map((j) => ({ loc: `${BASE}/${urlJogo(j)}`, mod: ultimaMudanca(j) })))
  .concat(times.map((t) => ({ loc: `${BASE}/${urlTime(t.nome)}`, mod: t.mod || geral })))
  .concat(rodadas.map((r) => ({ loc: `${BASE}/${urlRodada(r.liga, r.n)}`, mod: maxData(...r.jogos.map(ultimaMudanca)) })));
escrever("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.mod}</lastmod></url>`).join("\n")}\n</urlset>\n`);
const prefixo = new URL(BASE + "/").pathname;
escrever("robots.txt", `User-agent: *\nDisallow: ${prefixo}admin.html\n\nSitemap: ${BASE}/sitemap.xml\n`);

console.log(`Site gerado em _site/: ${jogos.length} jogos (${jogos.filter(jogado).length} com resultado), ${times.length} times, ${rodadas.length} rodadas, ${urls.length} URLs no sitemap.`);
