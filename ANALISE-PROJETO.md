# Análise do Projeto CR-Workflow - Firing Range

**Data:** Novembro/2025  
**Autor:** Análise Técnica

---

## 1. ANÁLISE DO PROCESSO (WORKFLOW)

### 1.1 Fluxo Atual do Processo CR

O sistema implementa um workflow de **6 etapas** organizadas em **3 fases**:

| Fase | Etapa | Status |
|------|-------|--------|
| **Fase 1: Cadastro/On-Boarding** | Central de Mensagens | ✅ Implementado |
| | Cadastro | ✅ Implementado |
| **Fase 2: Documentação/Laudos** | Encaminhamento Avaliação Psicológica | ✅ Implementado |
| | Agendamento de Laudo de Capacidade Técnica | ✅ Implementado |
| **Fase 3: Juntada-Sinarm-CAC** | Juntada de Documentos | ✅ Implementado |
| | Acompanhamento Sinarm-CAC | ✅ Implementado |

### 1.2 Pontos Fortes do Processo

1. **Rastreabilidade Completa**: Cada etapa possui registro de conclusão com timestamp
2. **Controle de Documentos**: 16 documentos definidos como subtarefas com upload individual
3. **Sistema de Emails Automatizados**: Templates personalizáveis com variáveis dinâmicas
4. **Acompanhamento Sinarm-CAC**: Status detalhado (Solicitado, Aguardando GRU, Em Análise, etc.)
5. **Controle de Acesso**: Segregação entre Admin e Operador

### 1.3 Lacunas Identificadas no Processo

| Lacuna | Impacto | Prioridade |
|--------|---------|------------|
| Sem notificações automáticas de prazos | Risco de perda de prazo documental | 🔴 Alta |
| Sem histórico de alterações | Dificulta auditoria | 🟡 Média |
| Sem alertas de documentos próximos do vencimento | Retrabalho | 🔴 Alta |
| Sem integração com calendário | Agendamentos manuais | 🟡 Média |
| Sem relatórios gerenciais | Falta visibilidade gestão | 🟡 Média |
| Sem fluxo de correção/revisão formal | Etapas retornam sem registro | 🟢 Baixa |

### 1.4 Sugestões de Melhoria no Processo

1. **Implementar Sistema de Alertas/Notificações**
   - Prazo de validade de documentos
   - Lembretes de agendamentos
   - Status pendente há mais de X dias

2. **Adicionar Histórico/Auditoria**
   - Log de todas as alterações
   - Quem alterou e quando
   - Versão anterior dos dados

3. **Implementar Dashboard de Métricas**
   - Tempo médio por etapa
   - Gargalos do processo
   - Taxa de deferimento/indeferimento

---

## 2. VALIDAÇÃO DOS DADOS DO CLIENTE

### 2.1 Campos Atuais Coletados

#### Dados Pessoais
| Campo | Tipo | Obrigatório | Adequação |
|-------|------|-------------|-----------|
| Nome Completo | text | ✅ Sim | ✅ Adequado |
| CPF | varchar(14) | ✅ Sim | ✅ Adequado |
| Sexo (M/F) | varchar(1) | ❌ Não | ✅ Adequado |
| Data Nascimento | varchar(10) | ❌ Não | ✅ Adequado |
| País Nascimento | varchar(100) | ❌ Não | ✅ Adequado |
| UF Nascimento | varchar(2) | ❌ Não | ✅ Adequado |
| Local Nascimento | varchar(255) | ❌ Não | ✅ Adequado |

#### Documentos de Identidade
| Campo | Tipo | Obrigatório | Adequação |
|-------|------|-------------|-----------|
| Nº Identidade | varchar(50) | ❌ Não | ✅ Adequado |
| Data Expedição | varchar(10) | ❌ Não | ✅ Adequado |
| Órgão Emissor | varchar(50) | ❌ Não | ✅ Adequado |
| UF Emissor | varchar(2) | ❌ Não | ✅ Adequado |

#### Contato
| Campo | Tipo | Obrigatório | Adequação |
|-------|------|-------------|-----------|
| Email | varchar(320) | ✅ Sim | ✅ Adequado |
| Telefone 1 | varchar(20) | ✅ Sim | ✅ Adequado |
| Telefone 2 | varchar(20) | ❌ Não | ✅ Adequado |

#### Endereço
| Campo | Tipo | Obrigatório | Adequação |
|-------|------|-------------|-----------|
| CEP | varchar(10) | ❌ Não | ✅ Adequado |
| Endereço | varchar(255) | ❌ Não | ✅ Adequado |
| Número | varchar(20) | ❌ Não | ✅ Adequado |
| Bairro | varchar(100) | ❌ Não | ✅ Adequado |
| Cidade | varchar(100) | ❌ Não | ✅ Adequado |
| Complemento | varchar(255) | ❌ Não | ✅ Adequado |

#### Filiação
| Campo | Tipo | Obrigatório | Adequação |
|-------|------|-------------|-----------|
| Nome da Mãe | varchar(255) | ❌ Não | ✅ Adequado |
| Nome do Pai | varchar(255) | ❌ Não | ✅ Adequado |

#### Dados Profissionais
| Campo | Tipo | Obrigatório | Adequação |
|-------|------|-------------|-----------|
| Profissão | varchar(255) | ❌ Não | ✅ Adequado |
| Outra Profissão | varchar(255) | ❌ Não | ✅ Adequado |
| Nr Registro | varchar(100) | ❌ Não | ✅ Adequado |
| Atividades Atuais | text | ❌ Não | ✅ Adequado |

### 2.2 Campos FALTANTES (Importantes para processo CR)

| Campo Sugerido | Justificativa | Prioridade |
|----------------|---------------|------------|
| **Estado Civil** | Exigido no formulário da PF | 🔴 Alta |
| **Nacionalidade** | Exigido no processo CR | 🔴 Alta |
| **Número do CR anterior** (se renovação) | Rastreabilidade | 🟡 Média |
| **Tipo de solicitação** (1ª vez/Renovação/2ª via) | Workflow diferenciado | 🔴 Alta |
| **Número do CAC/SIGMA** | Identificação junto à PF | 🔴 Alta |
| **Categoria do CAC** (Caçador/Atirador/Colecionador) | Requisitos diferentes | 🔴 Alta |
| **UF de Residência** | Separado da cidade | 🟡 Média |
| **Escolaridade** | Pode ser exigido | 🟢 Baixa |
| **Foto 3x4** (upload) | Necessária para documentação | 🟡 Média |
| **Validade do Laudo Psicológico** | Controle de vencimento | 🔴 Alta |
| **Validade do Laudo Técnico** | Controle de vencimento | 🔴 Alta |
| **Situação Militar** (se aplicável) | Pode ser exigido | 🟡 Média |

### 2.3 Recomendação de Novos Campos

```typescript
// Sugestão de campos adicionais no schema
maritalStatus: varchar("maritalStatus", { length: 20 }), // solteiro, casado, divorciado, viúvo, união estável
nationality: varchar("nationality", { length: 100 }).default("Brasileiro(a)"),
requestType: varchar("requestType", { length: 20 }), // first_time, renewal, second_copy
cacNumber: varchar("cacNumber", { length: 50 }), // Número do cadastro CAC
cacCategory: varchar("cacCategory", { length: 50 }), // caçador, atirador, colecionador
residenceUf: varchar("residenceUf", { length: 2 }),
psychReportValidity: varchar("psychReportValidity", { length: 10 }), // Data de validade
techReportValidity: varchar("techReportValidity", { length: 10 }), // Data de validade
previousCrNumber: varchar("previousCrNumber", { length: 50 }), // Para renovações
```

---

## 3. PLANO DE MELHORIAS DE USABILIDADE E MODERNIDADE VISUAL

### 3.1 Análise da Interface Atual

#### Pontos Positivos
- ✅ Identidade visual consistente (vermelho Firing Range #C41E3A)
- ✅ Uso de bordas tracejadas como elemento de design
- ✅ Cards bem estruturados
- ✅ Responsividade básica implementada
- ✅ Feedback visual de loading states
- ✅ Uso de ícones Lucide React

#### Pontos a Melhorar
- ⚠️ Formulários muito extensos sem wizard/steps
- ⚠️ Ausência de animações e transições suaves
- ⚠️ Cores inline via `style={}` em vez de classes
- ⚠️ Falta de skeleton loaders durante carregamento
- ⚠️ Modal de upload pode melhorar
- ⚠️ Falta validação visual em tempo real nos inputs
- ⚠️ Dashboard poderia ter gráficos visuais

---

### 3.2 PLANO DE MELHORIAS - FASE 1 (Curto Prazo)

#### 3.2.1 Melhorias de Formulário
| Melhoria | Descrição | Esforço |
|----------|-----------|---------|
| **Wizard de Cadastro** | Dividir formulário em steps (Dados Pessoais → Documentos → Endereço → Contato) | Médio |
| **Máscaras de Input** | CPF, CEP, Telefone com formatação automática | Baixo |
| **Validação em Tempo Real** | Feedback visual imediato de campos inválidos | Baixo |
| **Autocomplete de Endereço** | Busca CEP automática via ViaCEP | Baixo |
| **Campos Condicionais** | Mostrar "Outra Profissão" apenas se necessário | Baixo |

#### 3.2.2 Feedback Visual
| Melhoria | Descrição | Esforço |
|----------|-----------|---------|
| **Skeleton Loaders** | Substituir spinners por skeletons | Baixo |
| **Toast Notifications** | Já implementado com Sonner ✅ | - |
| **Progress Indicators** | Animações mais suaves nas barras | Baixo |
| **Hover States** | Microinterações em botões e cards | Baixo |

#### 3.2.3 Correções CSS
```css
/* Substituir styles inline por classes Tailwind */
/* Exemplo atual (ruim): style={{color: '#434242'}} */
/* Proposto: className="text-gray-700" */

/* Adicionar variáveis CSS personalizadas */
--color-success: #4d9702;
--color-warning: #db7929;
--color-info: #3b82f6;
```

---

### 3.3 PLANO DE MELHORIAS - FASE 2 (Médio Prazo)

#### 3.3.1 Dashboard Moderno
| Melhoria | Descrição | Esforço |
|----------|-----------|---------|
| **Gráficos Interativos** | Usar Recharts ou Chart.js para métricas | Médio |
| **Filtros Avançados** | Por status, operador, período | Médio |
| **Busca Global** | Busca em todos os campos | Médio |
| **Visualização Kanban** | Arrastar clientes entre etapas | Alto |
| **Timeline do Cliente** | Histórico visual de atividades | Médio |

#### 3.3.2 Componentes Modernos
| Melhoria | Descrição | Esforço |
|----------|-----------|---------|
| **Command Palette** | Atalhos de teclado (Cmd+K) | Médio |
| **Breadcrumbs** | Navegação contextual | Baixo |
| **Tabs Animadas** | Transições entre abas | Baixo |
| **Modal de Confirmação** | Substituir window.confirm | Baixo |
| **Dropdown de Usuário** | Avatar + menu de perfil | Baixo |

#### 3.3.3 Acessibilidade
| Melhoria | Descrição | Esforço |
|----------|-----------|---------|
| **ARIA Labels** | Labels para leitores de tela | Baixo |
| **Contraste de Cores** | Verificar WCAG 2.1 AA | Baixo |
| **Focus Visible** | Indicadores de foco keyboard | Baixo |
| **Skip Links** | Navegação por teclado | Baixo |

---

### 3.4 PLANO DE MELHORIAS - FASE 3 (Longo Prazo)

#### 3.4.1 Funcionalidades Avançadas
| Melhoria | Descrição | Esforço |
|----------|-----------|---------|
| **PWA** | Instalável + offline básico | Alto |
| **Notificações Push** | Alertas em tempo real | Alto |
| **Dark/Light Mode Toggle** | Já tem suporte, falta toggle | Baixo |
| **Exportar para PDF** | Relatório completo do cliente | Médio |
| **Importação em Massa** | Upload CSV de clientes | Alto |

#### 3.4.2 Performance
| Melhoria | Descrição | Esforço |
|----------|-----------|---------|
| **Virtual Scrolling** | Para listas grandes | Médio |
| **Lazy Loading** | Componentes sob demanda | Médio |
| **Image Optimization** | Next/Image ou sharp | Baixo |
| **Caching Avançado** | React Query otimizado | Médio |

---

### 3.5 MOCKUP DE MELHORIAS VISUAIS SUGERIDAS

#### 3.5.1 Dashboard Redesenhado
```
┌─────────────────────────────────────────────────────────────────┐
│ 🎯 FIRING RANGE               [🔍 Buscar...]  [👤 Admin ▼] [🚪] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ 📊 45    │ │ ⏳ 32    │ │ ✅ 13    │ │ 🔔 5     │           │
│  │ Total    │ │ Andamento│ │ Concluído│ │ Alertas  │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 📈 Progresso por Fase (Gráfico de Barras Empilhadas)    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────┐ ┌──────┐ ┌──────┐   [+ Novo Cliente]                 │
│  │ Card │ │ Card │ │ Card │   Filtros: [Todos ▼] [Operador ▼]  │
│  │Client│ │Client│ │Client│                                     │
│  └──────┘ └──────┘ └──────┘                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 3.5.2 Formulário em Steps
```
┌─────────────────────────────────────────────────────────────────┐
│  CADASTRO DE CLIENTE                                            │
│                                                                 │
│  ○ ─────── ● ─────── ○ ─────── ○                               │
│  Pessoal   Documentos Endereço   Contato                        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Número da Identidade                                     │   │
│  │ ┌─────────────────────────────────────────────────────┐ │   │
│  │ │ 1234567890                                    ✓     │ │   │
│  │ └─────────────────────────────────────────────────────┘ │   │
│  │                                                          │   │
│  │ Data de Expedição          Órgão Emissor                │   │
│  │ ┌───────────────────┐      ┌───────────────────┐        │   │
│  │ │ 📅 15/03/2020     │      │ SSP               │        │   │
│  │ └───────────────────┘      └───────────────────┘        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                               [← Voltar]  [Próximo →]           │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3.6 COMPONENTES RECOMENDADOS PARA ADICIONAR

| Componente | Biblioteca/Método | Uso |
|------------|-------------------|-----|
| **Gráficos** | `recharts` ou `chart.js` | Dashboard de métricas |
| **Calendário** | `react-day-picker` (já no shadcn) | Agendamentos |
| **Máscara de Input** | `react-input-mask` ou `@react-input/mask` | CPF, CEP, Telefone |
| **Editor Rico** | `tiptap` (React 19 compatível) | Templates de email |
| **Tour Guiado** | `react-joyride` | Onboarding de usuários |
| **Drag and Drop** | `@dnd-kit/core` | Kanban de clientes |

---

## 4. RESUMO EXECUTIVO

### Dados do Cliente
- **Status Atual**: 80% adequado para o processo CR
- **Campos Faltantes Críticos**: Estado Civil, Nacionalidade, Tipo de Solicitação, Número CAC, Categoria CAC, Validade dos Laudos

### Usabilidade
- **Prioridade 1**: Formulário em wizard, máscaras de input, skeleton loaders
- **Prioridade 2**: Dashboard com gráficos, filtros avançados, timeline
- **Prioridade 3**: PWA, notificações push, importação em massa

### Investimento Estimado
| Fase | Prazo | Complexidade |
|------|-------|--------------|
| Fase 1 | 2-3 semanas | Baixa-Média |
| Fase 2 | 4-6 semanas | Média |
| Fase 3 | 6-8 semanas | Alta |

---

**Documento gerado como base para discussão e planejamento de melhorias.**
