# Implantação de uma igreja nova

Para quem entrega o sistema (DevDias). O cliente não vê nada disto: recebe o sistema pronto.

## Passo a passo

1. **Copie a planilha modelo** (Arquivo → Fazer uma cópia). O script vai junto.
2. No editor do Apps Script da cópia, execute **`implantarIgreja`** (a 1ª vez autoriza os acessos pedidos).
   Ela cria a aba **Implantacao** e para.
3. Na aba **Implantacao**, preencha a coluna **Valor**. Obrigatórios: `ADMIN_NOME`, `ADMIN_EMAIL`, `NOME_IGREJA`. O resto é opcional (vazio = padrão do sistema).
4. Execute **`implantarIgreja`** de novo. Ela cria as abas, grava a identidade e cria o administrador, que recebe a senha temporária por e-mail (e é obrigado a trocá-la no primeiro acesso).
   Pode rodar quantas vezes quiser: não duplica nada.
5. Implante a aplicação web (Implantar → Nova implantação → App da Web; executar como **você**, acesso **qualquer pessoa**).
6. Entre no sistema com o administrador e, na tela **Identidade**, envie o **logo** (PNG transparente, versão clara) e, se for usar, a assinatura do pastor e a marca d'água.
7. Execute **`verificarImplantacao`**. O relatório mostra ✅ / ⚠️ / ❌. Entregue quando não houver ❌.

## Observações

- **Remetente dos e-mails:** o Gmail envia pela conta dona da planilha, mas o nome exibido é o da igreja. Ao transferir a propriedade da planilha para a igreja, os e-mails passam a sair da conta dela. Reautorize o envio de e-mails depois da transferência (rode `verificarImplantacao` na conta nova).
- **Limite de e-mails:** contas Gmail comuns enviam até ~100 e-mails por dia; o relatório mostra a cota restante.
- **Depois da entrega:** nome, cor, imagens e dados da carteirinha mudam na tela **Identidade** (somente administrador). Não é preciso mexer na planilha.
- **Membros já existentes:** a importação é feita caso a caso (cada igreja tem uma planilha diferente) e não faz parte da implantação padrão.
