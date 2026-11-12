# FORMA 2.2 — passo a passo: Supabase + Netlify

## Antes de começar

Esta versão substitui o PIN e os perfis pré-definidos por **cadastro com nome, e-mail e senha**, **login**, **esqueci minha senha** e **alteração de senha**. O aplicativo não contém usuários ou senhas iniciais. O banco guarda um documento JSON de dados para cada conta, isolado por RLS. O tema claro/escuro é uma preferência individual.

**O projeto só funcionará depois de você conectar seu próprio Supabase.** Não coloque sua senha nem a chave secreta `service_role` no JavaScript.

## 1. Prepare o backup da versão anterior

No FORMA 2.1, entre no perfil existente, acesse **Ajustes > Exportar backup** e baixe o JSON. Faça isso para cada perfil que tenha registros. Guarde os arquivos fora do navegador.

## 2. Crie o projeto Supabase

1. Entre em https://supabase.com/dashboard.
2. Crie um projeto (ou use um projeto existente separado para testes).
3. Abra **SQL Editor > New query**.
4. Copie todo o conteúdo de `banco.sql` e execute.
5. Confirme em **Table Editor** que foi criada `public.forma_profiles`.

O script habilita **Row Level Security (RLS)** e dá `SELECT`, `INSERT` e `UPDATE` somente na própria linha para usuários autenticados. O e-mail/senha são administrados pelo **Supabase Auth**, não por `forma_profiles`.

## 3. Configure o e-mail de login

1. Vá em **Authentication > Providers > Email**.
2. Mantenha o login por e-mail/senha ativado.
3. Recomenda-se habilitar **Confirm email**.
4. Vá em **Authentication > URL Configuration**.
5. Preencha **Site URL** com a URL HTTPS publicada pelo Netlify, por exemplo `https://meu-forma.netlify.app/`.
6. Inclua na lista **Redirect URLs** tanto `https://meu-forma.netlify.app/` quanto `https://meu-forma.netlify.app/index.html` (substituindo pelo endereço real).

Essas URLs são necessárias para confirmar o cadastro e abrir o link de **Esqueci minha senha**. Quando a plataforma exigir um remetente próprio ou tiver limites de mensagens, configure o serviço SMTP nas opções de autenticação para produção; o fluxo de testes depende de os e-mails chegarem.

## 4. Configure a chave pública

Abra **Project Settings > API Keys** (ou a opção **Connect** do seu projeto). Copie:

- **Project URL**: `https://SEU-PROJETO.supabase.co`
- **Publishable key** (preferida) ou a antiga **anon key**

No arquivo `supabase-config.js`, substitua os valores:

```javascript
window.FORMA_SUPABASE = {
  url: 'https://SEU-PROJETO.supabase.co',
  publishableKey: 'sb_publishable_SUA_CHAVE_PUBLICA'
};
```

Não substitua pela senha do banco, secret key ou service_role key. A chave pública é exposta no navegador por design; a segurança dos dados depende do RLS.

## 5. Publique no Netlify

1. Abra https://app.netlify.com/drop e entre na sua conta.
2. Arraste a **pasta FORMA** contendo `index.html`, `cloud.js`, `banco.sql` etc.
3. Se já tinha um site, no Netlify abra o mesmo projeto e publique como **novo deploy**; o endereço pode permanecer o mesmo.
4. Abra a URL HTTPS gerada.
5. Confirme que aparecem **E-mail**, **Senha**, **Criar conta** e **Esqueci minha senha**. A lista de perfis não deve aparecer.

Você pode fazer o passo 5 antes do passo 3: basta voltar ao Supabase e ajustar as URLs após receber o link definitivo do Netlify, e então testar o cadastro.

## 6. Teste as contas

1. Clique **Criar conta**; informe nome, e-mail e senha com ao menos 8 caracteres.
2. Se a confirmação de e-mail estiver ativada, clique no link recebido.
3. Faça login com e-mail e senha.
4. Crie um exercício, registre um treino, alterne o tema e aguarde **Salvo na nuvem**.
5. Saia e entre novamente: os dados devem continuar.
6. Crie outra conta com outro e-mail: os dados anteriores **não** devem aparecer.
7. No e-mail de uma das contas, use **Esqueci minha senha** e teste o fluxo completo.
8. Faça login em outro aparelho com **a mesma conta** e confirme a sincronização.

**Se os dados não carregarem**, confira se executou `banco.sql`, se a chave pública é a correta e se a sessão foi confirmada por e-mail. Se os links de recuperação abrirem a página errada, revise **Authentication > URL Configuration**.

## 7. Trazer os treinos antigos

1. Entre na conta que receberá o backup.
2. Vá em **Ajustes e backup > Importar backup (inclusive v2.1)**.
3. Selecione o arquivo JSON exportado pela versão anterior.
4. Confirme a substituição dos dados daquela conta.
5. Aguarde o status **Salvo na nuvem** e confirme no celular ou após atualizar a página.

A importação não transfere a senha/PIN antigo. Ela importa apenas registros, fichas, fotos embutidas, peso e suplementos. **Faça backup antes**, pois os registros atuais dessa conta serão substituídos.

## 8. Instalar como aplicativo (PWA)

No Android, abra a URL HTTPS no Chrome e selecione **Instalar app**. No iPhone, abra no Safari, use o menu de compartilhamento e escolha **Adicionar à Tela de Início**. A PWA depende da conexão para login e sincronização; não é um aplicativo nativo distribuído nas lojas.

## Cuidados na fase de teste

- Não compartilhe sua senha ou códigos de recuperação.
- Nunca exponha `service_role` ou `sb_secret_...` no site.
- O app salva em nuvem com um breve atraso de escrita para reduzir chamadas. **Espere aparecer "Salvo na nuvem" antes de fechar**.
- Se houver falha, use **Ajustes > Sincronizar agora**.
- Edições simultâneas no mesmo usuário em dispositivos diferentes podem causar a última escrita substituir a anterior (versão de testes).
- Fotos e dados corporais são informações pessoais: use um projeto de teste, mantenha RLS ativo e evite armazenar imagens íntimas.
- Este pacote não inclui um projeto Supabase real já configurado, nem usuários pré-criados.
