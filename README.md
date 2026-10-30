# Placar Provável

Site de probabilidades para jogos do Brasileirão, gerado a partir de um modelo de gols (Poisson com ajuste Dixon-Coles). A cada atualização do `dados/jogos.json`, um GitHub Action gera as páginas e publica no GitHub Pages.

## O que é gerado

- `index.html`: previsões abertas, resultados e desempenho, já em HTML (sem depender de JavaScript para o Google ler).
- `jogos/<mandante>-x-<visitante>-<data>.html`: uma página por jogo, com texto, placares mais prováveis, título e descrição próprios, prévia de compartilhamento e dados estruturados (`SportsEvent`).
- `como-funciona.html`: metodologia e teste histórico.
- `sitemap.xml`, `robots.txt`, `404.html`.

## Arquivos que você edita

| Arquivo | Para que serve |
|---|---|
| `dados/jogos.json` | Previsões e resultados. É o único que muda no dia a dia (pelo `admin.html`) |
| `site.json` | Nome e endereço do site. **Troque a `url` quando tiver domínio próprio** |
| `nomes.json` | Grafia dos times nas páginas (ex.: `"Gremio RS": "Grêmio"`). Times fora da lista perdem só a sigla do estado |

Os demais (`scripts/build.js`, `modelo.js`, `comum.js`, `estilo.css`, `admin.html`, `.github/workflows/publicar.yml`) são o código do site.

## Configuração (uma vez)

1. Envie todos os arquivos desta pasta para o repositório, **incluindo as pastas `.github`, `scripts` e `dados`**. Apague o `index.html` antigo da raiz, se existir: agora ele é gerado automaticamente.
2. Em **Settings → Pages → Build and deployment → Source**, troque para **GitHub Actions**.
3. Em **Actions**, aguarde a execução **Publicar site** ficar verde.

## Rotina

1. Abra `/admin.html` no site, adicione jogos ou placares e clique em **Copiar JSON**.
2. No GitHub, edite `dados/jogos.json`, cole e clique em **Commit changes**.
3. Em 1 ou 2 minutos as páginas estão no ar.

## Google

1. Cadastre o site no [Google Search Console](https://search.google.com/search-console).
2. Em **Sitemaps**, envie `sitemap.xml`.
3. Com domínio próprio, o `robots.txt` passa a valer (no endereço `github.io` ele não fica na raiz do domínio e é ignorado; o `admin.html` já tem `noindex`).

## Testar localmente (opcional)

```
node scripts/build.js
```
O site sai na pasta `_site/`.
