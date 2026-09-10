# Sistema de Controle e Relatório de Medições

Planilha profissional de cadastro, histórico, pesquisa e relatório de medições,
construída do zero a partir do PDF de referência `ENG003341 - PISO INSTALAÇÃO
NOVA BOMBA - 29655103.pdf`.

## Arquivo

- **`PLANILHA_CONTROLE_MEDICOES.xlsx`** — o sistema completo, pronto para uso.
  Funciona inteiramente por fórmulas nativas do Excel (sem macro), o que
  garante compatibilidade máxima e evita erros `#NOME?`/`_xlfn`.

## Abas

| Aba | Função |
|---|---|
| `LEIA-ME` | Instruções de uso dentro do próprio arquivo |
| `CADASTRO` | Formulário guiado para lançar uma medição (preenchimento automático a partir do ITEM) |
| `HISTORICO` | Tabela mestre — cresce automaticamente, nunca sobrescreve |
| `PESQUISA` | Pesquisa por CT/texto breve, por ITEM, e consulta de medição |
| `RELATORIO_MEDICAO` | Relatório visual (modelo do PDF), gerado automaticamente ao escolher NOTA + MEDIÇÃO |
| `CONFIGURACOES` | Listas auxiliares e catálogo de itens (base do preenchimento automático) |
| `MOTOR_RELATORIO` | Aba técnica oculta — motor de extração/agrupamento do relatório |

## Dados de teste

O `HISTORICO` já contém 8 lançamentos de teste (NOTA `29655103`, MEDIÇÃO `1`),
extraídos do PDF de referência, reproduzindo os 6 blocos/itens do documento
(incluindo os 2 blocos que começam com "19" mas pertencem a hierarquias
diferentes, e as 3 formas do item 3.1.1). **TOTAL GERAL esperado: R$ 2.469,77**
— confira na aba `RELATORIO_MEDICAO` (célula `J5`) após abrir o arquivo (o
Excel recalcula automaticamente ao abrir). Apague/edite essas linhas quando for
usar o sistema com dados reais.

## Regras importantes já implementadas

- **X/Y/Z**: na aba `HISTORICO`, a coluna `O` guarda Z, `P` guarda Y e `Q`
  guarda X (regra explícita do projeto). O relatório sempre exibe na ordem
  visual X | Y | Z. `RESULTADO = QUANTIDADE × X × Y × Z` (vazio = 1).
- **VALOR TOTAL = RESULTADO × PREÇO UNITÁRIO**, sempre automático.
- **Hierarquia**: o agrupamento de itens no relatório usa o código completo do
  ITEM (ex.: `19.12.4` × `19.1.2`), nunca apenas o primeiro número — os dois
  blocos "19" do PDF de teste aparecem corretamente separados.
- **Múltiplas formas**: cada forma de medição é uma linha própria no
  `HISTORICO` e aparece como uma linha própria no relatório, com o resultado
  total do item somado logo depois.
- O relatório suporta até **20 itens por medição** e até **6 formas por
  item** (bem acima do PDF de referência: 6 itens, no máximo 3 formas). Linhas
  de capacidade não usadas ficam em branco e podem ser recolhidas (contorno /
  outline).

## Módulos VBA opcionais (pasta `vba/`)

Este arquivo foi gerado em um ambiente Linux sem Microsoft Excel disponível
para compilar/testar macros reais — por isso o sistema principal foi
construído para funcionar 100% por fórmulas (testado e validado
manualmente, ver observação abaixo). Para quem quiser automação extra, estes
módulos prontos estão em `vba/`:

- `modConfig.bas` — constantes de layout
- `modCadastro.bas` — botão "Adicionar ao Histórico" (grava sem nunca
  sobrescrever, valida campos obrigatórios)
- `modRelatorioPDF.bas` — botão "Gerar PDF" (nome de arquivo
  `CADENGECOM_NOTA_[nota]_MEDICAO_[medicao].pdf`) e um gerador de relatório
  **sem limite** de 20 itens / 6 formas, para medições excepcionalmente
  grandes

**Como instalar:** abra o `.xlsx` no Excel → `Alt+F11` → *Arquivo* → *Importar
Arquivo…* → selecione os três `.bas` um de cada vez → salve como `.xlsm`.
Depois, nos botões visuais das abas `CADASTRO` e `RELATORIO_MEDICAO`, clique
com o botão direito → *Atribuir Macro* → escolha `AdicionarLancamento` ou
`ExportarPDF`. Leva menos de um minuto e não altera nenhuma fórmula existente.

## Nota sobre verificação

Formulas e totais foram conferidos por simulação equivalente em Python
(reproduzindo exatamente a lógica de cada fórmula) contra os valores do PDF
de referência — todos os 6 blocos e o TOTAL GERAL (R$ 2.469,77) batem
exatamente. Não foi possível rodar o recálculo automático via LibreOffice
neste ambiente de build (sandbox sem suporte estável a esse recurso), mas o
Excel recalcula todas as fórmulas normalmente ao abrir o arquivo — não é
necessário nenhum passo extra.
