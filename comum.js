/* Funções de apoio usadas pelo site e pela página de administração. */
function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function pct(x){ return Math.round(x * 100) + "%"; }
function dataBR(d){ if (!d) return "—"; var p = d.split("-"); return p[2] + "/" + p[1]; }
function jogado(j){ return j.gc !== null && j.gc !== undefined && j.gc !== "" && j.gf !== null && j.gf !== undefined && j.gf !== ""; }
function fav(j){ return j.p1 >= j.px && j.p1 >= j.p2 ? "1" : (j.p2 >= j.px ? "2" : "X"); }
function res(j){ return j.gc > j.gf ? "1" : (j.gc < j.gf ? "2" : "X"); }
function nomeFav(j){ var f = fav(j); return f === "1" ? j.casa : f === "2" ? j.fora : "Empate"; }
function brier(j){ var r = res(j); var y = [r === "1" ? 1 : 0, r === "X" ? 1 : 0, r === "2" ? 1 : 0];
  return Math.pow(j.p1 - y[0], 2) + Math.pow(j.px - y[1], 2) + Math.pow(j.p2 - y[2], 2); }
function ordData(a, b, dir){ var x = a.data || "", y = b.data || ""; if (x === y) return 0; if (!x) return 1; if (!y) return -1; return dir * (x < y ? -1 : 1); }

var MESES_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function dataCurtaL(d, lang){ if (!d) return "—"; var p = d.split("-"); return lang === "en" ? MESES_EN[+p[1] - 1] + " " + (+p[2]) : p[2] + "/" + p[1]; }
function numL(x, c, lang){ var s = x.toFixed(c); return lang === "en" ? s : s.replace(".", ","); }

function cartao(j, extraHtml, lang){
  var en = lang === "en";
  return '<article class="game">' +
    '<div class="meta"><span>' + esc(j.liga) + '</span><span>' + dataCurtaL(j.data, lang) + '</span></div>' +
    '<div class="teams"><strong>' + esc(j.casa) + '</strong><span class="muted">×</span><strong class="r">' + esc(j.fora) + '</strong></div>' +
    '<div class="bar" aria-hidden="true"><i class="s1" style="width:' + (j.p1 * 100).toFixed(1) + '%"></i><i class="sx" style="width:' + (j.px * 100).toFixed(1) + '%"></i><i class="s2" style="width:' + (j.p2 * 100).toFixed(1) + '%"></i></div>' +
    '<div class="pcts"><div><b>' + pct(j.p1) + '</b><span>' + (en ? "Home" : "Casa") + '</span></div><div><b>' + pct(j.px) + '</b><span>' + (en ? "Draw" : "Empate") + '</span></div><div><b>' + pct(j.p2) + '</b><span>' + (en ? "Away" : "Fora") + '</span></div></div>' +
    '<div class="extra"><span>' + (en ? "Expected goals" : "Gols esperados") + ' <b>' + numL(j.xgc, 2, lang) + ' × ' + numL(j.xgf, 2, lang) + '</b></span><span>' + (en ? "Over 2.5" : "Mais de 2,5") + ' <b>' + pct(j.o25) + '</b></span><span>' + (en ? "Both teams score" : "Ambas marcam") + ' <b>' + pct(j.bts) + '</b></span></div>' +
    (extraHtml || '') + '</article>';
}
