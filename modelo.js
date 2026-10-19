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
  var iT = L.findIndex(function(s){ return /^Teams League Statistic/i.test(s); });
  if (iT >= 0 && L[iT + 1]){
    var nomes = L[iT + 1].split(/\t+/).map(function(s){ return s.trim(); }).filter(Boolean);
    if (nomes.length >= 2){ out.casa = nomes[0]; out.fora = nomes[1]; }
  }
  var sc = L.filter(function(s){ return /^Average Scored/i.test(s); }).map(nums);
  var co = L.filter(function(s){ return /^Average Conceded/i.test(s); }).map(nums);
  if (sc.length >= 2 && co.length >= 2){
    out.cMarc = sc[0][0]; out.fMarc = sc[0][1]; out.cSof = co[0][0]; out.fSof = co[0][1];
    out.cMarcCasa = sc[1][0]; out.fMarcFora = sc[1][1]; out.cSofCasa = co[1][0]; out.fSofFora = co[1][1];
  }
  function depois(rx){ var i = L.findIndex(function(s){ return rx.test(s); }); if (i < 0) return undefined;
    for (var k = i; k < Math.min(i + 3, L.length); k++){ var n = nums(L[k].replace(rx, "")); if (n.length) return n[0]; } }
  out.lgH = depois(/^Home Goals per Game/i); out.lgA = depois(/^Away Goals per Game/i);
  var t = L.find(function(s){ return /^Table\s+/i.test(s); }); if (t) out.liga = t.replace(/^Table\s+/i, "");
  var d = texto.match(/\b(\d{2})\.(\d{2})\.(20\d{2})\b/); if (d) out.data = d[3] + "-" + d[2] + "-" + d[1];
  ["casa","fora","cMarc","cSof","fMarc","fSof","cMarcCasa","cSofCasa","fMarcFora","fSofFora","lgH","lgA"].forEach(function(k){ if (out[k] === undefined) faltando.push(k); });
  return {dados: out, faltando: faltando};
}

