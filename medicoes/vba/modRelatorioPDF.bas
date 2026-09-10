Attribute VB_Name = "modRelatorioPDF"
Option Explicit

' Exporta a aba RELATORIO_MEDICAO para PDF, usando a NOTA e a MEDICAO
' selecionadas nas celulas C5/F5 para montar o nome do arquivo:
'   CADENGECOM_NOTA_[nota]_MEDICAO_[medicao].pdf
' O arquivo e salvo na mesma pasta desta planilha.
Public Sub ExportarPDF()
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Sheets(SH_RELATORIO)

    Dim nota As String, medicao As String
    nota = Trim(ws.Range(REL_SEL_NOTA).Text)
    medicao = Trim(ws.Range(REL_SEL_MEDICAO).Text)

    If nota = "" Or medicao = "" Then
        MsgBox "Selecione a NOTA e a MEDICAO (celulas C5 e F5) antes de gerar o PDF.", vbExclamation
        Exit Sub
    End If

    Dim nomeArquivo As String
    nomeArquivo = "CADENGECOM_NOTA_" & nota & "_MEDICAO_" & medicao & ".pdf"

    Dim caminho As String
    caminho = ThisWorkbook.Path
    If caminho = "" Then caminho = Environ$("USERPROFILE") & "\Documents"

    On Error GoTo TratarErro
    ws.ExportAsFixedFormat Type:=xlTypePDF, _
        Filename:=caminho & Application.PathSeparator & nomeArquivo, _
        Quality:=xlQualityStandard, IncludeDocProperties:=True, _
        IgnorePrintAreas:=False, OpenAfterPublish:=False
    On Error GoTo 0

    MsgBox "PDF gerado com sucesso:" & vbCrLf & caminho & Application.PathSeparator & nomeArquivo, _
           vbInformation, "PDF gerado"
    Exit Sub

TratarErro:
    MsgBox "Nao foi possivel gerar o PDF: " & Err.Description, vbCritical, "Erro ao exportar"
End Sub

' Versao totalmente dinamica do relatorio (sem o limite de 20 itens / 6 formas
' do modelo de formulas). Le o HISTORICO para a NOTA+MEDICAO selecionadas,
' agrupa por ITEM (respeitando a ordem de cadastro) e escreve o relatorio do
' zero, inserindo exatamente as linhas necessarias para cada bloco. Use esta
' rotina somente se sua medicao ultrapassar a capacidade padrao do modelo de
' formulas (20 itens ou mais de 6 formas em algum item).
Public Sub GerarRelatorioDinamicoSemLimite()
    Dim wsHist As Worksheet, wsRel As Worksheet
    Set wsHist = ThisWorkbook.Sheets(SH_HISTORICO)
    Set wsRel = ThisWorkbook.Sheets(SH_RELATORIO)

    Dim nota As Variant, medicao As Variant
    nota = wsRel.Range(REL_SEL_NOTA).Value
    medicao = wsRel.Range(REL_SEL_MEDICAO).Value
    If nota = "" Or medicao = "" Then
        MsgBox "Selecione a NOTA e a MEDICAO antes de gerar o relatorio.", vbExclamation
        Exit Sub
    End If

    Dim lastRow As Long
    lastRow = wsHist.Cells(wsHist.Rows.Count, "A").End(xlUp).Row
    If lastRow < HIST_DATA_START Then
        MsgBox "Nao ha lancamentos no HISTORICO.", vbExclamation
        Exit Sub
    End If

    Application.ScreenUpdating = False

    ' limpa a area de blocos existente (a partir da linha 11 ate a antiga
    ' linha do TOTAL GERAL, localizada procurando o texto na coluna B)
    Dim totalRow As Long, r As Long
    totalRow = 0
    For r = 11 To wsRel.Rows.Count
        If wsRel.Cells(r, "B").Value = "TOTAL GERAL" Then
            totalRow = r
            Exit For
        End If
    Next r
    If totalRow = 0 Then totalRow = wsRel.Rows.Count

    wsRel.Range(wsRel.Cells(11, 2), wsRel.Cells(totalRow, 11)).EntireRow.Delete

    Dim outRow As Long
    outRow = 11

    Dim curItem As String, prevItem As String
    Dim formaCount As Long, resultTotal As Double, valorTotal As Double
    Dim firstOfBlock As Boolean

    prevItem = vbNullString
    Dim i As Long
    Dim pendingHeaderRow As Long

    For i = HIST_DATA_START To lastRow
        If wsHist.Cells(i, "A").Value = nota And wsHist.Cells(i, "C").Value = medicao Then
            curItem = CStr(wsHist.Cells(i, "I").Value)
            If curItem <> prevItem Then
                ' fecha bloco anterior (escreve subtotal) --------------------
                If prevItem <> vbNullString Then
                    wsRel.Cells(outRow, 4).Resize(1, 6).Merge
                    wsRel.Cells(outRow, 4).Value = "RESULTADO TOTAL DO ITEM"
                    wsRel.Cells(outRow, 4).Font.Bold = True
                    wsRel.Cells(outRow, 4).HorizontalAlignment = xlRight
                    wsRel.Cells(outRow, 10).Value = resultTotal
                    wsRel.Cells(outRow, 10).NumberFormat = "0.0000"
                    wsRel.Cells(outRow, 10).Font.Bold = True
                    wsRel.Cells(outRow, 11).Value = valorTotal
                    wsRel.Cells(outRow, 11).NumberFormat = """R$"" #,##0.00"
                    wsRel.Cells(outRow, 11).Font.Bold = True
                    outRow = outRow + 1
                End If

                ' cabecalho do novo bloco (N1 / N2 / item) -----------------------
                Dim n1c As String, n1t As String, n2c As String, n2t As String
                Dim linha As Variant, ativ As String, und As String
                n1c = BuscaCatalogo(curItem, "N1C"): n1t = BuscaCatalogo(curItem, "N1T")
                n2c = BuscaCatalogo(curItem, "N2C"): n2t = BuscaCatalogo(curItem, "N2T")
                linha = wsHist.Cells(i, "J").Value
                ativ = wsHist.Cells(i, "K").Value
                und = wsHist.Cells(i, "M").Value

                wsRel.Cells(outRow, 2).Value = n1c
                wsRel.Cells(outRow, 2).Font.Bold = True
                wsRel.Cells(outRow, 4).Resize(1, 8).Merge
                wsRel.Cells(outRow, 4).Value = n1t
                wsRel.Cells(outRow, 4).Font.Bold = True
                outRow = outRow + 1

                If n2c <> "" Then
                    wsRel.Cells(outRow, 2).Value = n2c
                    wsRel.Cells(outRow, 4).Resize(1, 8).Merge
                    wsRel.Cells(outRow, 4).Value = n2t
                    wsRel.Cells(outRow, 4).Font.Italic = True
                    outRow = outRow + 1
                End If

                wsRel.Cells(outRow, 2).Value = curItem
                wsRel.Cells(outRow, 2).Font.Bold = True
                wsRel.Cells(outRow, 3).Value = linha
                wsRel.Cells(outRow, 4).Value = ativ
                wsRel.Cells(outRow, 4).WrapText = True
                wsRel.Cells(outRow, 5).Value = und
                outRow = outRow + 1

                resultTotal = 0: valorTotal = 0
                prevItem = curItem
            End If

            ' linha da forma --------------------------------------------------------
            wsRel.Cells(outRow, 4).Value = wsHist.Cells(i, "L").Value
            wsRel.Cells(outRow, 6).Value = wsHist.Cells(i, "N").Value
            wsRel.Cells(outRow, 7).Value = wsHist.Cells(i, "Q").Value   ' X
            wsRel.Cells(outRow, 8).Value = wsHist.Cells(i, "P").Value   ' Y
            wsRel.Cells(outRow, 9).Value = wsHist.Cells(i, "O").Value   ' Z
            wsRel.Cells(outRow, 10).Value = wsHist.Cells(i, "R").Value  ' RESULTADO
            wsRel.Cells(outRow, 10).NumberFormat = "0.0000"
            resultTotal = resultTotal + wsHist.Cells(i, "R").Value
            valorTotal = valorTotal + wsHist.Cells(i, "T").Value
            outRow = outRow + 1
        End If
    Next i

    ' fecha o ultimo bloco -------------------------------------------------------------
    If prevItem <> vbNullString Then
        wsRel.Cells(outRow, 4).Resize(1, 6).Merge
        wsRel.Cells(outRow, 4).Value = "RESULTADO TOTAL DO ITEM"
        wsRel.Cells(outRow, 4).Font.Bold = True
        wsRel.Cells(outRow, 4).HorizontalAlignment = xlRight
        wsRel.Cells(outRow, 10).Value = resultTotal
        wsRel.Cells(outRow, 10).NumberFormat = "0.0000"
        wsRel.Cells(outRow, 10).Font.Bold = True
        wsRel.Cells(outRow, 11).Value = valorTotal
        wsRel.Cells(outRow, 11).NumberFormat = """R$"" #,##0.00"
        wsRel.Cells(outRow, 11).Font.Bold = True
        outRow = outRow + 1
    End If

    outRow = outRow + 1
    wsRel.Cells(outRow, 2).Resize(1, 8).Merge
    wsRel.Cells(outRow, 2).Value = "TOTAL GERAL"
    wsRel.Cells(outRow, 2).Font.Bold = True
    wsRel.Cells(outRow, 2).Font.Size = 13
    wsRel.Cells(outRow, 10).Resize(1, 2).Merge
    wsRel.Cells(outRow, 10).Value = _
        Application.WorksheetFunction.SumIfs(wsHist.Range("T" & HIST_DATA_START & ":T" & lastRow), _
            wsHist.Range("A" & HIST_DATA_START & ":A" & lastRow), nota, _
            wsHist.Range("C" & HIST_DATA_START & ":C" & lastRow), medicao)
    wsRel.Cells(outRow, 10).NumberFormat = """R$"" #,##0.00"
    wsRel.Cells(outRow, 10).Font.Bold = True
    wsRel.Cells(outRow, 10).Font.Size = 13

    Application.ScreenUpdating = True
    MsgBox "Relatorio dinamico gerado (sem limite de itens/formas) ate a linha " & outRow & ".", vbInformation
End Sub

Private Function BuscaCatalogo(item As String, campo As String) As String
    Dim wsCfg As Worksheet
    Set wsCfg = ThisWorkbook.Sheets(SH_CONFIG)
    Dim lastRow As Long, r As Long
    lastRow = wsCfg.Cells(wsCfg.Rows.Count, "B").End(xlUp).Row
    For r = 37 To lastRow
        If wsCfg.Cells(r, "B").Value = item Then
            Select Case campo
                Case "N1C": BuscaCatalogo = wsCfg.Cells(r, "C").Value
                Case "N1T": BuscaCatalogo = wsCfg.Cells(r, "D").Value
                Case "N2C": BuscaCatalogo = wsCfg.Cells(r, "E").Value
                Case "N2T": BuscaCatalogo = wsCfg.Cells(r, "F").Value
            End Select
            Exit Function
        End If
    Next r
    BuscaCatalogo = ""
End Function
