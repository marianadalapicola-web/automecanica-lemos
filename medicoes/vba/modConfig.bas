Attribute VB_Name = "modConfig"
Option Explicit

' Constantes de layout - devem refletir exatamente a estrutura das abas
' geradas em PLANILHA_CONTROLE_MEDICOES.xlsx. Se as abas forem reorganizadas
' manualmente, ajuste os valores abaixo.

Public Const SH_HISTORICO As String = "HISTORICO"
Public Const SH_CADASTRO As String = "CADASTRO"
Public Const SH_RELATORIO As String = "RELATORIO_MEDICAO"
Public Const SH_CONFIG As String = "CONFIGURACOES"
Public Const SH_MOTOR As String = "MOTOR_RELATORIO"

Public Const HIST_HEADER_ROW As Long = 2
Public Const HIST_DATA_START As Long = 3

' Linhas do formulario da aba CADASTRO (rotulo na coluna B, valor na coluna C).
' O formulario esta organizado em 3 paineis coloridos (DADOS DA MEDICAO / ITEM
' DA MEDICAO / VALORES-STATUS), por isso os numeros nao sao sequenciais.
Public Const CAD_NOTA As Long = 7
Public Const CAD_TMED As Long = 8
Public Const CAD_MEDICAO As Long = 9
Public Const CAD_ELAB As Long = 10
Public Const CAD_OBRA As Long = 11
Public Const CAD_FISCAL As Long = 12
Public Const CAD_CT As Long = 13
Public Const CAD_SUPER As Long = 14
Public Const CAD_DATA As Long = 15
Public Const CAD_ITEM As Long = 17
Public Const CAD_LINHA As Long = 18      ' auto (formula)
Public Const CAD_ATIVIDADE As Long = 19  ' auto (formula)
Public Const CAD_DESCRICAO As Long = 20
Public Const CAD_UND As Long = 21        ' auto/editavel
Public Const CAD_QTD As Long = 22
Public Const CAD_X As Long = 23
Public Const CAD_Y As Long = 24
Public Const CAD_Z As Long = 25
Public Const CAD_PU As Long = 27         ' auto/editavel
Public Const CAD_STATUS As Long = 28

Public Const REL_SEL_NOTA As String = "C5"
Public Const REL_SEL_MEDICAO As String = "F5"
