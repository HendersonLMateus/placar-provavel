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
const dados = JSON.parse(fs.readFileSync(path.join(RAIZ, "dados/jogos.json"), "utf8"));

// Carrega o modelo e as funções comuns do próprio site, para os números baterem com o admin.
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(RAIZ, "modelo.js"), "utf8"), ctx);
vm.runInContext(fs.readFileSync(path.join(RAIZ, "comum.js"), "utf8"), ctx);
const { esc, pct, jogado, fav, res, brier, ordData, cartao, placares } = ctx;

/* ---------- utilidades ---------- */
const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const LIGAS = { "Brasileirão Série A": "Brasileirão Série A", "Serie A": "Brasileirão Série A", "Serie B": "Brasileirão Série B", "Serie C": "Brasileirão Série C" };
const nomeLiga = (l) => LIGAS[l] || l || "Brasileirão";
const dataLonga = (d) => { if (!d) return ""; const [a, m, dd] = d.split("-"); return `${+dd} de ${MESES[+m - 1]} de ${a}`; };
const dataCurta = (d) => { if (!d) return ""; const [a, m, dd] = d.split("-"); return `${dd}/${m}/${a}`; };
const num = (x, c = 2) => x.toFixed(c).replace(".", ",");
const slugify = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// Nomes do Primatips vêm com a UF ("Bahia BA"). nomes.json traz grafias corretas e desfaz ambiguidades
// (Atlético-MG x Athletico-PR); os demais perdem só a sigla.
const NOMES = fs.existsSync(path.join(RAIZ, "nomes.json")) ? JSON.parse(fs.readFileSync(path.join(RAIZ, "nomes.json"), "utf8")) : {};
const nomeTime = (t) => NOMES[t] || t.replace(/\s+[A-Z]{2}$/, "");
const curto = (t) => t;
const slugJogo = (j) => `${slugify(curto(j.casa))}-x-${slugify(curto(j.fora))}${j.data ? "-" + j.data : "-" + j.id}`;
const urlJogo = (j) => `jogos/${slugJogo(j)}.html`;
const hoje = new Date().toISOString().slice(0, 10);

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

/* ---------- layout comum ---------- */
function pagina({ titulo, descricao, caminho, raiz, corpo, jsonld, tipo = "website", noindex = false }) {
  const canon = BASE + "/" + (caminho === "index.html" ? "" : caminho);
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descricao)}">
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
<nav class="topo" aria-label="Principal"><a class="marca" href="${raiz}">${esc(site.nome)}</a><span><a href="${raiz}">Previsões</a><a href="${raiz}como-funciona.html">Como funciona</a></span></nav>
${corpo}
<footer class="aviso"><p>Conteúdo estatístico e informativo, não é recomendação de aposta. Apostas são proibidas para menores de 18 anos. Se for apostar, faça isso com responsabilidade e só com dinheiro que você pode perder.</p></footer>
</div>
</body>
</html>
`;
}

/* ---------- textos ---------- */
function resumoJogo(j) {
  const c = curto(j.casa), f = curto(j.fora), F = fav(j);
  let t;
  if (F === "1") t = `O modelo aponta o ${c} como favorito jogando em casa, com ${pct(j.p1)} de chance de vitória, contra ${pct(j.p2)} do ${f} e ${pct(j.px)} de empate.`;
  else if (F === "2") t = `O modelo aponta o ${f} como favorito mesmo fora de casa, com ${pct(j.p2)} de chance de vitória, contra ${pct(j.p1)} do ${c} e ${pct(j.px)} de empate.`;
  else t = `O modelo vê um jogo equilibrado, com o empate como resultado mais provável (${pct(j.px)}), contra ${pct(j.p1)} do ${c} e ${pct(j.p2)} do ${f}.`;
  const diff = Math.abs(j.p1 - j.p2);
  if (F !== "X" && diff < 0.1) t += " A diferença entre os dois lados é pequena, então o favoritismo é leve.";
  return t;
}
function golsJogo(j) {
  const c = curto(j.casa), f = curto(j.fora), tot = j.xgc + j.xgf;
  const ritmo = tot >= 2.9 ? "acima da média do campeonato" : tot <= 2.3 ? "abaixo da média do campeonato" : "perto da média do campeonato";
  return `A expectativa é de ${num(j.xgc)} gol para o ${c} e ${num(j.xgf)} para o ${f}, num total de ${num(tot, 1)} gols, ${ritmo}. ` +
    `Isso dá ${pct(j.o25)} de chance de mais de 2,5 gols e ${pct(j.bts)} de os dois times marcarem.`;
}
function textoResultado(j) {
  const ok = fav(j) === res(j);
  const r = `${curto(j.casa)} ${j.gc} x ${j.gf} ${curto(j.fora)}`;
  const quem = fav(j) === "1" ? curto(j.casa) : fav(j) === "2" ? curto(j.fora) : "o empate";
  const pr = { "1": j.p1, "X": j.px, "2": j.p2 }[res(j)];
  return ok ? `Resultado final: ${r}. O favorito do modelo (${quem}) confirmou a previsão.`
    : `Resultado final: ${r}. O modelo apontava ${quem}; o resultado que aconteceu tinha ${pct(pr)} de probabilidade. Previsões erradas continuam no histórico, junto com as certas.`;
}

/* ---------- página de jogo ---------- */
function paginaJogo(j) {
  const c = curto(j.casa), f = curto(j.fora), liga = nomeLiga(j.liga);
  const tops = placares(j.xgc, j.xgf, 5);
  const titulo = `${c} x ${f}: probabilidades e placar provável${j.data ? " (" + dataCurta(j.data) + ")" : ""}`;
  const descricao = `${c} x ${f} pelo ${liga}${j.data ? " em " + dataLonga(j.data) : ""}: ${pct(j.p1)} vitória do ${c}, ${pct(j.px)} empate, ${pct(j.p2)} vitória do ${f}. Gols esperados ${num(j.xgc)} x ${num(j.xgf)}; placar mais provável ${tops[0].gc} x ${tops[0].gf}.`;
  const jsonld = {
    "@context": "https://schema.org", "@type": "SportsEvent",
    name: `${c} x ${f}`, sport: "Futebol", description: descricao,
    ...(j.data ? { startDate: j.data } : {}),
    ...(jogado(j) ? {} : { eventStatus: "https://schema.org/EventScheduled" }),
    homeTeam: { "@type": "SportsTeam", name: c }, awayTeam: { "@type": "SportsTeam", name: f },
    superEvent: { "@type": "SportsEvent", name: liga },
    url: `${BASE}/${urlJogo(j)}`
  };
  const lista = tops.map((p) => `<tr><td>${c} ${p.gc} x ${p.gf} ${f}</td><td class="c">${num(p.p * 100, 1)}%</td></tr>`).join("");
  const corpo = `<main class="artigo">
<header><span class="eyebrow">${esc(liga)}${j.data ? " · " + dataLonga(j.data) : ""}</span><h1>${esc(c)} x ${esc(f)}: probabilidades e placar provável</h1></header>
${jogado(j) ? `<p class="destaque ${fav(j) === res(j) ? "ok" : "bad"}">${esc(textoResultado(j))}</p>` : ""}
<div class="games solo">${cartao(j)}</div>
<section><h2>Quem é o favorito</h2><p>${esc(resumoJogo(j))}</p></section>
<section><h2>Gols esperados</h2><p>${esc(golsJogo(j))}</p></section>
<section><h2>Placares mais prováveis</h2>
<div class="tablewrap"><table><thead><tr><th>Placar</th><th class="c">Probabilidade</th></tr></thead><tbody>${lista}</tbody></table></div>
<p class="muted nota">Mesmo o placar mais provável costuma ter menos de 15% de chance. O modelo indica tendências, não resultados certos.</p></section>
<section><h2>De onde vêm esses números</h2><p>As probabilidades saem de um modelo de gols que compara o ataque e a defesa de cada time com a média da liga, na campanha geral e em casa ou fora. <a href="../como-funciona.html">Veja como o modelo funciona e o histórico de acertos</a>.</p></section>
<p><a href="../">← Todas as previsões</a></p>
</main>`;
  return pagina({ titulo: `${titulo} | ${site.nome}`, descricao, caminho: urlJogo(j), raiz: "../", corpo, jsonld, tipo: "article" });
}

/* ---------- página inicial ---------- */
function paginaInicial(jogos) {
  const pend = jogos.filter((j) => !jogado(j)).sort((a, b) => ordData(a, b, 1));
  const feitos = jogos.filter(jogado).sort((a, b) => ordData(a, b, -1));
  const acertos = feitos.filter((j) => fav(j) === res(j)).length;
  const br = feitos.length ? feitos.reduce((s, j) => s + brier(j), 0) / feitos.length : null;
  const o25 = feitos.filter((j) => (j.o25 >= 0.5) === (j.gc + j.gf > 2)).length;
  const link = (j, html) => `<a class="cardlink" href="${urlJogo(j)}" aria-label="${esc(curto(j.casa))} x ${esc(curto(j.fora))}: ver análise">${html}</a>`;

  const corpo = `<header><span class="eyebrow">Modelo de gols · Brasileirão${dados.atualizado ? " · atualizado em " + dataCurta(dados.atualizado) : ""}</span><h1>${esc(site.nome)}</h1>
<p class="muted">Probabilidades calculadas por um modelo estatístico de gols, sem palpite pago e sem ligação com casas de aposta. Cada previsão é registrada antes do jogo e o resultado entra no placar de desempenho abaixo, acerte ou erre.</p></header>
<section><h2>Desempenho até aqui</h2><div class="stats">
<div class="stat"><b>${feitos.length}</b><span>jogos avaliados</span></div>
<div class="stat"><b>${feitos.length ? Math.round(acertos / feitos.length * 100) + "%" : "—"}</b><span>favorito do modelo venceu (${acertos} de ${feitos.length})</span></div>
<div class="stat"><b>${br === null ? "—" : num(br, 3)}</b><span>Brier score (menor é melhor)</span></div>
<div class="stat"><b>${feitos.length ? Math.round(o25 / feitos.length * 100) + "%" : "—"}</b><span>acerto em mais/menos de 2,5</span></div>
</div><p class="muted nota">Com poucos jogos, esses números oscilam muito. No teste com 2.280 jogos da Série A de 2019 a 2024, o favorito do modelo venceu em 48,7% das vezes, contra 46,2% de apostar sempre no mandante.</p></section>
<section><h2>Próximos jogos</h2>${pend.length ? `<div class="games">${pend.map((j) => link(j, cartao(j))).join("")}</div>`
    : `<div class="empty">Nenhuma previsão aberta no momento. As próximas aparecem aqui antes de cada rodada.</div>`}</section>
<section><h2>Resultados</h2>${feitos.length ? `<div class="tablewrap"><table><thead><tr><th>Data</th><th>Jogo</th><th class="c">Placar</th><th>Favorito do modelo</th><th class="c">Casa · Emp · Fora</th><th class="c"></th></tr></thead><tbody>${
    feitos.map((j) => { const ok = fav(j) === res(j); const fn = fav(j) === "1" ? curto(j.casa) : fav(j) === "2" ? curto(j.fora) : "Empate";
      return `<tr><td>${j.data ? dataCurta(j.data).slice(0, 5) : "—"}</td><td><a href="${urlJogo(j)}">${esc(curto(j.casa))} x ${esc(curto(j.fora))}</a></td><td class="c"><b>${j.gc} – ${j.gf}</b></td><td>${esc(fn)} (${pct(Math.max(j.p1, j.px, j.p2))})</td><td class="c">${pct(j.p1)} · ${pct(j.px)} · ${pct(j.p2)}</td><td class="c"><span class="pill ${ok ? "ok\">acertou" : "bad\">errou"}</span></td></tr>`; }).join("")
    }</tbody></table></div>` : `<div class="empty">Os resultados aparecem aqui depois de cada jogo.</div>`}</section>
<section><h2>Como funciona</h2><p>O modelo estima os gols esperados de cada time a partir do ataque e da defesa, e calcula a chance de cada placar. <a href="como-funciona.html">Leia a metodologia completa</a>.</p></section>`;
  const jsonld = { "@context": "https://schema.org", "@type": "WebSite", name: site.nome, url: BASE + "/", inLanguage: "pt-BR", description: site.descricao };
  return pagina({ titulo: `${site.nome}: probabilidades dos jogos do Brasileirão`, descricao: site.descricao, caminho: "index.html", raiz: "", corpo, jsonld });
}

/* ---------- metodologia ---------- */
function paginaMetodo() {
  const corpo = `<main class="artigo">
<header><span class="eyebrow">Metodologia</span><h1>Como o modelo calcula as probabilidades</h1></header>
<section><h2>A ideia</h2><p>Futebol tem poucos gols, e o número de gols de um time numa partida segue de perto uma distribuição de Poisson. Se sabemos quantos gols cada time deve marcar em média naquele jogo, dá para calcular a chance de cada placar e, somando os placares, a chance de vitória, empate, mais de 2,5 gols e ambas marcam.</p></section>
<section><h2>Os gols esperados</h2><ul>
<li>Para cada time, medimos a força de ataque (gols marcados) e de defesa (gols sofridos) em relação à média da liga.</li>
<li>Fazemos isso duas vezes: na campanha geral e na campanha só em casa (mandante) ou só fora (visitante), e usamos a média das duas leituras. A campanha geral tem mais jogos e é mais estável; a de mando captura quem rende muito mais em casa.</li>
<li>Os gols esperados do mandante combinam o ataque dele com a defesa do visitante, e vice-versa.</li></ul></section>
<section><h2>O ajuste de Dixon-Coles</h2><p>A distribuição de Poisson pura erra um pouco nos placares baixos (0 x 0, 1 x 0, 0 x 1, 1 x 1). Aplicamos a correção proposta por Dixon e Coles em 1997, usada em boa parte dos modelos de futebol.</p></section>
<section><h2>Teste com jogos passados</h2><p>Antes de publicar, testamos uma versão completa do modelo em 2.280 jogos da Série A de 2019 a 2024, prevendo cada partida só com dados anteriores a ela.</p>
<div class="tablewrap"><table><thead><tr><th>Método</th><th class="c">Acerto do resultado</th></tr></thead><tbody>
<tr><td>Este modelo</td><td class="c"><b>48,7%</b></td></tr><tr><td>Apostar sempre no mandante</td><td class="c">46,2%</td></tr><tr><td>Média histórica da liga</td><td class="c">46,2%</td></tr></tbody></table></div>
<p>Nos jogos em que o favorito tinha 60% ou mais, ele venceu em 66% das vezes. As probabilidades também se mostraram bem calibradas: quando o modelo diz 30%, o resultado acontece perto de 30% das vezes.</p></section>
<section><h2>O que o modelo não faz</h2><ul>
<li>Não sabe de lesões, suspensões, escalação reserva ou troca de técnico.</li>
<li>Não garante resultado. Nenhum modelo de futebol acerta perto de 90%; o empate acontece em cerca de 27% dos jogos e quase nunca é o resultado mais provável.</li>
<li>Não é recomendação de aposta.</li></ul></section>
<p><a href="./">← Ver as previsões</a></p>
</main>`;
  return pagina({ titulo: `Como funciona o modelo | ${site.nome}`, descricao: "Metodologia do Placar Provável: modelo de Poisson com ajuste Dixon-Coles, gols esperados por ataque e defesa, e teste em 2.280 jogos do Brasileirão.", caminho: "como-funciona.html", raiz: "", corpo, tipo: "article" });
}

/* ---------- gerar ---------- */
fs.rmSync(SAIDA, { recursive: true, force: true });
fs.mkdirSync(SAIDA, { recursive: true });
["estilo.css", "comum.js", "modelo.js", "admin.html", "dados/jogos.json", "og.png", "favicon.svg", ".nojekyll"].forEach(copiar);

const jogos = dados.jogos.map((j) => Object.assign({}, j, { casa: nomeTime(j.casa), fora: nomeTime(j.fora), liga: nomeLiga(j.liga) }));
escrever("index.html", paginaInicial(jogos));
escrever("como-funciona.html", paginaMetodo());
jogos.forEach((j) => escrever(urlJogo(j), paginaJogo(j)));
escrever("404.html", pagina({ titulo: `Página não encontrada | ${site.nome}`, descricao: site.descricao, caminho: "404.html", raiz: BASE + "/", noindex: true,
  corpo: `<main class="artigo"><h1>Página não encontrada</h1><p>Esse endereço não existe ou o jogo foi removido. <a href="${BASE}/">Ver todas as previsões</a>.</p></main>` }));

const urls = [{ loc: BASE + "/", mod: dados.atualizado || hoje }, { loc: BASE + "/como-funciona.html", mod: dados.atualizado || hoje }]
  .concat(jogos.map((j) => ({ loc: `${BASE}/${urlJogo(j)}`, mod: dados.atualizado || j.data || hoje })));
escrever("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.mod}</lastmod></url>`).join("\n")}\n</urlset>\n`);
const prefixo = new URL(BASE + "/").pathname;
escrever("robots.txt", `User-agent: *\nDisallow: ${prefixo}admin.html\n\nSitemap: ${BASE}/sitemap.xml\n`);

console.log(`Site gerado em _site/: ${jogos.length} páginas de jogo, ${urls.length} URLs no sitemap.`);
