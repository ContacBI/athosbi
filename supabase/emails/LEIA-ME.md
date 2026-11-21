# E-mails do login (Supabase)

Os e-mails de acesso (esqueci minha senha, convite) saem do próprio Supabase.
O texto e o visual ficam em **Authentication › Emails** de cada projeto
(teste e oficial) — não vão pelo GitHub. Este é o modelo para colar lá.

## Esqueci minha senha — `recuperar-senha.html`

**Assunto:** `Crie uma nova senha · Athos Hub B.I.`

**Onde colar** (primeiro no projeto de **teste**; no oficial só quando o site
oficial for atualizado):

1. Entre em supabase.com e abra o projeto.
2. Menu da esquerda: **Authentication** › **Emails** (em versões antigas,
   **Email Templates**).
3. Abra o modelo **Reset password** (ou "Reset Password").
4. Em **Subject**, cole o assunto acima.
5. Em **Message body** (modo **Source**/HTML), apague tudo e cole o conteúdo
   inteiro de `recuperar-senha.html`.
6. **Save**.

**Confira também** em **Authentication** › **URL Configuration**:

- **Site URL** do projeto de teste: `https://teste.bi.athosconsultoriaempresarial.com`
- **Site URL** do projeto oficial: o endereço do site oficial.

O botão do e-mail usa o Site URL (`{{ .SiteURL }}/confirmar-acesso`). Se o
projeto de teste estiver com o endereço do oficial, o link abre o site errado
e não funciona.

## Como funciona

- O botão leva para `/confirmar-acesso?token_hash=…&type=recovery`.
- No **teste**, essa página já é a da senha nova no visual do hub
  (`src/hub/NovaSenhaHub.jsx`): abre direto no formulário e só usa o link
  quando a pessoa clica em **Salvar a nova senha**. Um verificador de
  segurança do e-mail (Outlook/Microsoft, Google) que abre o link sozinho não
  gasta nada.
- No **oficial**, a mesma página continua com o botão "Continuar" e depois a
  tela "Defina sua senha" (`ConfirmAccess.jsx` + `SetPassword.jsx`), até o
  visual novo subir.
- O link vale por **1 hora** (padrão do Supabase, em Authentication ›
  Providers › Email › *Email OTP expiration*) e funciona uma vez só. Se mudar
  esse prazo, ajuste o texto do e-mail e da tela.
- O Supabase só manda outro e-mail para o mesmo endereço depois de 1 minuto;
  a tela já espera esse tempo antes de liberar o "Reenviar".

## Remetente

Sem um SMTP próprio configurado (Authentication › Emails › **SMTP Settings**),
o Supabase manda por um servidor de teste com limite baixo de envios por hora
e remetente genérico. Para os clientes, o ideal é um SMTP próprio com o
remetente da Athos (ex.: `nao-responda@athosconsultoriaempresarial.com`).
