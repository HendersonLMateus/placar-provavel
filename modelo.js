/* Modelo de gols (Poisson + ajuste Dixon-Coles) e leitura da página colada. */
/* ---------- modelo (mesma lógica do script Python) ---------- */
var RHO = -0.05;
function pmf(k, l){ var p = Math.exp(-l); for (var i = 1; i <= k; i++) p *= l / i; return p; }
function probs(lh, la){
  var N = 11, M = [], s = 0, H = 0, D = 0, A = 0, O = 0, B = 0, i, j;
  for (i = 0; i < N; i++){ M[i] = []; for (j = 0; j < N; j++){ M[i][j] = pmf(i, lh) * pmf(j, la); } }
  M[0][0] *= 1 - lh * la * RHO; M[0][1] *= 1 + lh * RHO; M[1][0] *= 1 + la * RHO; M[1][1] *= 1 - RHO;
  for (i = 0; i < N; i++) for (j = 0; j < N; j++) s += M[i][j];
  for (i = 0; i < N; i++) for (j = 0; j < N; j++){
    var p = M[i][j] / s;
    if (i > j) H += p; else if (i === j) D += p; else A += p;
    if (i + j > 2) O += p; if (i > 0 && j > 0) B += p;
  }
  return {p1: H, px: D, p2: A, o25: O, bts: B};
}
function prever(e){
  var m = (e.lgH + e.lgA) / 2;
  var lh1 = e.cMarcCasa * e.fSofFora / e.lgH, la1 = e.fMarcFora * e.cSofCasa / e.lgA;
  var lh2 = e.lgH * (e.cMarc / m) * (e.fSof / m), la2 = e.lgA * (e.fMarc / m) * (e.cSof / m);
  var lh = (lh1 + lh2) / 2, la = (la1 + la2) / 2, p = probs(lh, la);
  return {xgc: +lh.toFixed(2), xgf: +la.toFixed(2), p1: +p.p1.toFixed(4), px: +p.px.toFixed(4), p2: +p.p2.toFixed(4), o25: +p.o25.toFixed(4), bts: +p.bts.toFixed(4)};
}

/* ---------- leitura da página colada ---------- */
function nums(line){ return (line.match(/\d+(?:\.\d+)?/g) || []).map(Number); }
function ler(texto){
  var L = texto.split(/\r?\n/).map(function(s){ return s.replace(/ /g, " ").trim(); });
  var out = {}, faltando = [];
  var iT = L.findIndex(function(s){ return /^(Teams League Statistic|Estatísticas da equipe)/i.test(s); });
  if (iT >= 0 && L[iT + 1]){
    var nomes = L[iT + 1].split(/\t+/).map(function(s){ return s.trim(); }).filter(Boolean);
    if (nomes.length >= 2){ out.casa = nomes[0]; out.fora = nomes[1]; }
  }
  var sc = L.filter(function(s){ return /^(Average Scored|Média gols marcados)/i.test(s); }).map(nums);
  var co = L.filter(function(s){ return /^(Average Conceded|Média gols sofridos)/i.test(s); }).map(nums);
  if (sc.length >= 2 && co.length >= 2){
    out.cMarc = sc[0][0]; out.fMarc = sc[0][1]; out.cSof = co[0][0]; out.fSof = co[0][1];
    out.cMarcCasa = sc[1][0]; out.fMarcFora = sc[1][1]; out.cSofCasa = co[1][0]; out.fSofFora = co[1][1];
  }
  function depois(rx){ var i = L.findIndex(function(s){ return rx.test(s); }); if (i < 0) return undefined;
    for (var k = i; k < Math.min(i + 3, L.length); k++){ var n = nums(L[k].replace(rx, "")); if (n.length) return n[0]; } }
  out.lgH = depois(/^(Home Goals per Game|Gols [\s\S]m casa por partida)/i); out.lgA = depois(/^(Away Goals per Game|Gols visitante por partida)/i);
  var t = L.find(function(s){ return /^(Table|Classificação)\s+/i.test(s); }); if (t) out.liga = t.replace(/^(Table|Classificação)\s+/i, "");
  var d = texto.match(/\b(\d{2})\.(\d{2})\.(20\d{2})\b/); if (d) out.data = d[3] + "-" + d[2] + "-" + d[1];
  ["casa","fora","cMarc","cSof","fMarc","fSof","cMarcCasa","cSofCasa","fMarcFora","fSofFora","lgH","lgA"].forEach(function(k){ if (out[k] === undefined) faltando.push(k); });
  // Data e hora no horário local do estádio. O Primatips mostra a data no fuso dele e a hora local entre parênteses
  // ("22:30 (19:30 horário local)"); jogos à noite no Brasil podem aparecer com a data do dia seguinte.
  var h = texto.match(/(\d{1,2}):(\d{2})\s*\((\d{1,2}):(\d{2})\s*(?:local time|horário local)\)/i);
  if (h && out.data){
    var dif = (+h[1] * 60 + +h[2]) - (+h[3] * 60 + +h[4]);
    if (dif < -720) dif += 1440; if (dif > 720) dif -= 1440;
    var dt = new Date(Date.UTC(+out.data.slice(0, 4), +out.data.slice(5, 7) - 1, +out.data.slice(8, 10), +h[1], +h[2]) - dif * 60000);
    out.data = dt.toISOString().slice(0, 10); out.hora = h[3].padStart(2, "0") + ":" + h[4];
  }
  try { out.ctx = lerContexto(L, out.casa, out.fora); } catch (e) { out.ctx = null; }
  return {dados: out, faltando: faltando};
}

/* Contexto do jogo (tabela, forma, confronto direto, campanha). Tudo opcional: o que não for encontrado fica de fora. */
function normNome(s){ return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+[a-z]{2}$/, "").replace(/[^a-z0-9]/g, ""); }
function lerPartidas(L, i){
  var out = [];
  for (var k = i + 1; k + 3 < L.length; ){
    if (/^\d{4}-\d{2}-\d{2}$/.test(L[k]) && /^\d+\s*-\s*\d+$/.test(L[k + 2])){
      var g = L[k + 2].split("-").map(function(x){ return +x.trim(); });
      out.push({d: L[k], c: L[k + 1], f: L[k + 3], gc: g[0], gf: g[1]}); k += 4;
    } else if (/^(W|V)\s+(D|E)\s+(L|D)\b/.test(L[k]) || /^(More|Mais)/.test(L[k])) break;
    else k++;
  }
  return out;
}
function lerContexto(L, casa, fora){
  var ctx = {}, nc = normNome(casa), nf = normNome(fora);
  // Classificação
  var iTab = L.findIndex(function(s){ return /^(Table|Classificação)\s+/i.test(s); });
  if (iTab >= 0){
    var tab = [];
    for (var k = iTab + 2; k + 2 < L.length; k += 3){
      if (!/^\d{1,2}$/.test(L[k])) break;
      var n = nums(L[k + 2]);
      if (n.length < 8) break;
      tab.push({pos: +L[k], time: L[k + 1], j: n[0], v: n[1], e: n[2], d: n[3], pts: n[n.length - 1]});
    }
    var ach = function(nn){ return tab.find(function(t){ return normNome(t.time) === nn; }); };
    var tc = ach(nc), tf = ach(nf);
    if (tc) ctx.tc = {pos: tc.pos, pts: tc.pts, j: tc.j};
    if (tf) ctx.tf = {pos: tf.pos, pts: tf.pts, j: tf.j};
    if (tab.length >= 17) ctx.ref = {lider: tab[0].pts, g4: tab[3].pts, g6: tab[5].pts, z4: tab[16].pts, n: tab.length};
  }
  // Últimos jogos de cada time e confronto direto
  L.forEach(function(s, i){
    if (/^(H2H last \d+ games|Últimos \d+ jogos diretas)/i.test(s)){
      ctx.h2h = lerPartidas(L, i).slice(0, 5);
      return;
    }
    var m = s.match(/^(.+?)\s+(last \d+ games|últimos \d+ jogos)$/i);
    if (!m) return;
    var quem = normNome(m[1]) === nc ? "uc" : normNome(m[1]) === nf ? "uf" : null;
    if (!quem) return;
    var nn = quem === "uc" ? nc : nf;
    ctx[quem] = lerPartidas(L, i).slice(0, 5).map(function(p){
      var emCasa = normNome(p.c) === nn, gp = emCasa ? p.gc : p.gf, gs = emCasa ? p.gf : p.gc;
      return {d: p.d, adv: emCasa ? p.f : p.c, m: emCasa ? "c" : "f", gp: gp, gs: gs, r: gp > gs ? "V" : gp < gs ? "D" : "E"};
    });
  });
  // Campanha em casa (mandante) e fora (visitante): segunda ocorrência de vitórias/empates/derrotas
  var linha = function(rx){ return L.filter(function(s){ return rx.test(s); }).map(nums); };
  var V = linha(/^(Wins|Vitórias)\b/i), E = linha(/^(Draws|Empates)\b/i), D = linha(/^(Losses|Derrotas)\b/i);
  if (V.length >= 2 && E.length >= 2 && D.length >= 2){
    ctx.cc = [V[1][0], E[1][0], D[1][0]];
    ctx.cf = [V[1][1], E[1][1], D[1][1]];
  }
  return Object.keys(ctx).length ? ctx : null;
}


/* Placares mais prováveis (mesmo modelo), em ordem decrescente de probabilidade. */
function placares(lh, la, n){
  var N = 11, M = [], s = 0, out = [], i, j;
  for (i = 0; i < N; i++){ M[i] = []; for (j = 0; j < N; j++) M[i][j] = pmf(i, lh) * pmf(j, la); }
  M[0][0] *= 1 - lh * la * RHO; M[0][1] *= 1 + lh * RHO; M[1][0] *= 1 + la * RHO; M[1][1] *= 1 - RHO;
  for (i = 0; i < N; i++) for (j = 0; j < N; j++) s += M[i][j];
  for (i = 0; i < N; i++) for (j = 0; j < N; j++) out.push({gc: i, gf: j, p: M[i][j] / s});
  return out.sort(function(a, b){ return b.p - a.p; }).slice(0, n || 3);
}
