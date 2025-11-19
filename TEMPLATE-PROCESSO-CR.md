# Template de Email: Processo de Obtenção do CR

## Visão Geral

Este documento descreve o novo template de email para o **Processo de Obtenção do Certificado de Registro (CR)**, criado para informar clientes sobre o processo completo e destacar a presença de arquivos anexos com informações complementares.

## Características do Template

### Estrutura Visual

O template utiliza uma estrutura profissional e organizada com os seguintes elementos:

- **Cabeçalho destacado** em verde escuro (#1c5c00) com título e subtítulo
- **Corpo do email** em fundo cinza claro (#f9f9f9) para melhor legibilidade
- **Seções bem definidas** com títulos em verde e bordas inferiores
- **Caixas de destaque** para informações importantes
- **Rodapé informativo** com aviso de email automático

### Seções do Email

#### 1. Saudação Personalizada
Utiliza a variável `{{nome}}` para personalização.

#### 2. Informações Importantes
Explica brevemente o que é o CR e a importância do processo.

#### 3. Documentação e Informações Complementares
**Seção principal** que destaca os arquivos anexos, incluindo:
- Lista completa de documentos necessários
- Prazos e etapas do processo
- Orientações sobre avaliações obrigatórias
- Requisitos legais e normativos
- Procedimentos de segurança e guarda

#### 4. Próximos Passos
Orienta o cliente sobre o que fazer após ler os materiais anexos.

#### 5. Aviso de Atenção
Caixa amarela destacada alertando sobre a importância do cumprimento dos requisitos legais.

#### 6. Contato
Informações de contato usando variáveis:
- `{{email}}` - Email do cliente
- `{{telefone}}` - Telefone do cliente

## Variáveis Disponíveis

O template suporta as seguintes variáveis que serão substituídas automaticamente:

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `{{nome}}` | Nome completo do cliente | João da Silva |
| `{{email}}` | Email do cliente | joao@example.com |
| `{{telefone}}` | Telefone do cliente | (11) 98765-4321 |
| `{{data}}` | Data atual | 19/11/2025 |
| `{{status}}` | Status do workflow | 65% concluído |
| `{{status_sinarm}}` | Status Sinarm-CAC | Em Análise |

## Como Usar

### 1. Acessar Página de Templates

1. Login como **administrador**
2. Menu lateral → **"Templates de Email"**
3. Selecionar aba **"Processo CR"**

### 2. Copiar e Colar o Template

1. Abrir o arquivo `email-template-processo-cr.html`
2. Copiar todo o conteúdo HTML
3. Colar no campo "Conteúdo (HTML)" do template
4. Ajustar o assunto conforme necessário

### 3. Adicionar Anexos

1. Clicar em **"Adicionar Anexo"**
2. Selecionar arquivo PDF com informações complementares
3. Repetir para cada documento necessário
4. Clicar em **"Salvar Template"**

### 4. Enviar Email

1. Acessar workflow do cliente
2. Expandir etapa correspondente
3. Clicar em **"Visualizar"** para preview
4. Clicar em **"Enviar Email"**
5. Sistema enviará email com anexos automaticamente

## Sugestões de Anexos

Recomenda-se anexar os seguintes documentos PDF:

1. **Lista de Documentos Necessários** - Checklist completo
2. **Guia do Processo CR** - Passo a passo detalhado
3. **Requisitos Legais** - Legislação aplicável
4. **Formulários** - Modelos para preenchimento
5. **FAQ** - Perguntas frequentes

## Personalização

O template pode ser personalizado conforme necessário:

- **Cores**: Alterar códigos hexadecimais (#1c5c00, #4d9702)
- **Texto**: Adaptar mensagens para o contexto específico
- **Seções**: Adicionar ou remover seções conforme necessário
- **Estilos**: Ajustar fontes, espaçamentos e bordas

## Boas Práticas

1. **Sempre teste o envio** antes de usar em produção
2. **Verifique os anexos** para garantir que estão corretos
3. **Revise as variáveis** para confirmar substituição correta
4. **Mantenha backup** do template original
5. **Documente alterações** feitas no template

## Exemplo de Assunto

Sugestões de assunto para o email:

- "Processo de Obtenção do CR - Informações e Documentação"
- "{{nome}} - Documentação Necessária para o Certificado de Registro"
- "Próximos Passos: Obtenção do seu Certificado de Registro (CR)"

## Suporte

Para dúvidas ou problemas com o template:

1. Verificar se todas as variáveis estão corretas
2. Testar envio para email de teste primeiro
3. Confirmar que anexos foram adicionados
4. Verificar logs de email no sistema

---

**Criado em:** 19/11/2025  
**Versão:** 1.0  
**Autor:** Manus AI
