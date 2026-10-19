# Placar Provável

Site estático com as probabilidades de um modelo de gols (Poisson com ajuste Dixon-Coles) para jogos do Brasileirão, e o histórico público de acertos.

## Arquivos

| Arquivo | Para que serve |
|---|---|
| `index.html` | O site público |
| `admin.html` | Página de uso interno para adicionar jogos e placares (não aparece em links do site) |
| `dados/jogos.json` | Todas as previsões e resultados. É o único arquivo que muda no dia a dia |
| `modelo.js` | O modelo e a leitura da página colada |
| `comum.js`, `estilo.css` | Funções e visual compartilhados |

## Publicar no GitHub Pages (uma vez)

1. Crie um repositório público no GitHub, por exemplo `placar-provavel`.
2. Clique em **Add file → Upload files**, arraste todos os arquivos desta pasta (incluindo a pasta `dados`) e clique em **Commit changes**.
3. Vá em **Settings → Pages**. Em *Source*, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)`, e salve.
4. Em 1 ou 2 minutos o site fica em `https://SEU-USUARIO.github.io/placar-provavel/`.

## Atualizar a cada rodada

1. Abra `https://SEU-USUARIO.github.io/placar-provavel/admin.html`.
2. Cole a página do jogo, clique em **Ler página**, confira os números e em **Adicionar jogo**. Depois do jogo, registre o placar.
3. Clique em **Copiar JSON**.
4. No GitHub, abra `dados/jogos.json`, clique no lápis, apague tudo, cole e clique em **Commit changes**.

A página `admin.html` fica pública no endereço, mas não consegue alterar o site: só quem tem acesso ao repositório consegue subir o `jogos.json`.

## Domínio próprio (opcional)

Em **Settings → Pages → Custom domain**, informe o domínio (ex.: `placarprovavel.com.br`) e crie no seu provedor de domínio um registro CNAME apontando para `SEU-USUARIO.github.io`.
