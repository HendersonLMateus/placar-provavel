# Placar Provável

Site estático com as probabilidades de um modelo de gols (Poisson com ajuste Dixon-Coles) para jogos do Brasileirão, e o histórico público de acertos.

## Atualizar a cada rodada

1. Abra `https://SEU-USUARIO.github.io/placar-provavel/admin.html`.
2. Cole a página do jogo, clique em **Ler página**, confira os números e em **Adicionar jogo**. Depois do jogo, registre o placar.
3. Clique em **Copiar JSON**.
4. No GitHub, abra `dados/jogos.json`, clique no lápis, apague tudo, cole e clique em **Commit changes**.

A página `admin.html` fica pública no endereço, mas não consegue alterar o site: só quem tem acesso ao repositório consegue subir o `jogos.json`.

## Domínio próprio (opcional)

Em **Settings → Pages → Custom domain**, informe o domínio (ex.: `placarprovavel.com.br`) e crie no seu provedor de domínio um registro CNAME apontando para `SEU-USUARIO.github.io`.
