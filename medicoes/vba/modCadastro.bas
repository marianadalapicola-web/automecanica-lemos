Attribute VB_Name = "modCadastro"
Option Explicit

' Copia o formulario da aba CADASTRO para a proxima linha livre da aba
' HISTORICO. Nunca sobrescreve linhas existentes: sempre acrescenta.
' RESULTADO e VALOR TOTAL sao deixados intocados (ja existem como formula
' em todas as linhas da tabela HISTORICO, pre-preenchidas na geracao do
' arquivo).
Public Sub AdicionarLancamento()
    Dim wsCad As Worksheet, wsHist As Worksheet
    Set wsCad = ThisWorkbook.Sheets(SH_CADASTRO)
    Set wsHist = ThisWorkbook.Sheets(SH_HISTORICO)

    Dim faltando As String
    If Trim(wsCad.Range("C" & CAD_NOTA).Text) = "" Then faltando = faltando & "- NOTA" & vbCrLf
    If Trim(wsCad.Range("C" & CAD_TMED).Text) = "" Then faltando = faltando & "- T.MED" & vbCrLf
    If Trim(wsCad.Range("C" & CAD_MEDICAO).Text) = "" Then faltando = faltando & "- MEDICAO" & vbCrLf
    If Trim(wsCad.Range("C" & CAD_OBRA).Text) = "" Then faltando = faltando & "- OBRA" & vbCrLf
    If Trim(wsCad.Range("C" & CAD_DATA).Text) = "" Then faltando = faltando & "- DATA" & vbCrLf
    If Trim(wsCad.Range("C" & CAD_ITEM).Text) = "" Then faltando = faltando & "- ITEM" & vbCrLf

    If Len(faltando) > 0 Then
        MsgBox "Preencha os campos obrigatorios antes de adicionar:" & vbCrLf & vbCrLf & faltando, _
               vbExclamation, "Campos obrigatorios"
        Exit Sub
    End If

    Dim numericos As Variant, nomes As Variant, i As Long
    numericos = Array(CAD_QTD, CAD_X, CAD_Y, CAD_Z, CAD_PU)
    nomes = Array("QUANTIDADE", "X", "Y", "Z", "PRECO UNITARIO")
    For i = LBound(numericos) To UBound(numericos)
        Dim v As Variant
        v = wsCad.Range("C" & numericos(i)).Value
        If Not (v = "") Then
            If Not IsNumeric(v) Then
                MsgBox "O campo " & nomes(i) & " precisa ser um numero valido.", vbExclamation, "Valor invalido"
                Exit Sub
            End If
        End If
    Next i

    ' proxima linha livre = primeira linha, a partir de HIST_DATA_START, com a
    ' coluna A (NOTA) vazia
    Dim r As Long
    r = HIST_DATA_START
    Do While Trim(wsHist.Cells(r, "A").Text) <> ""
        r = r + 1
        If r > 100000 Then
            MsgBox "Nao foi possivel localizar uma linha livre na aba HISTORICO.", vbCritical
            Exit Sub
        End If
    Loop

    With wsHist
        .Cells(r, "A").Value = wsCad.Range("C" & CAD_NOTA).Value
        .Cells(r, "B").Value = wsCad.Range("C" & CAD_TMED).Value
        .Cells(r, "C").Value = wsCad.Range("C" & CAD_MEDICAO).Value
        .Cells(r, "D").Value = wsCad.Range("C" & CAD_ELAB).Value
        .Cells(r, "E").Value = wsCad.Range("C" & CAD_OBRA).Value
        .Cells(r, "F").Value = wsCad.Range("C" & CAD_FISCAL).Value
        .Cells(r, "G").Value = wsCad.Range("C" & CAD_CT).Value
        .Cells(r, "H").Value = wsCad.Range("C" & CAD_SUPER).Value
        .Cells(r, "I").Value = wsCad.Range("C" & CAD_ITEM).Value
        .Cells(r, "J").Value = wsCad.Range("C" & CAD_LINHA).Value       ' snapshot (valor, nao formula)
        .Cells(r, "K").Value = wsCad.Range("C" & CAD_ATIVIDADE).Value   ' snapshot
        .Cells(r, "L").Value = wsCad.Range("C" & CAD_DESCRICAO).Value
        .Cells(r, "M").Value = wsCad.Range("C" & CAD_UND).Value         ' snapshot (preserva "OUTROS" digitado)
        .Cells(r, "N").Value = wsCad.Range("C" & CAD_QTD).Value
        .Cells(r, "O").Value = wsCad.Range("C" & CAD_Z).Value
        .Cells(r, "P").Value = wsCad.Range("C" & CAD_Y).Value
        .Cells(r, "Q").Value = wsCad.Range("C" & CAD_X).Value
        ' R (RESULTADO) permanece com a formula ja existente na linha - nao mexer
        .Cells(r, "S").Value = wsCad.Range("C" & CAD_PU).Value          ' snapshot
        ' T (VALOR TOTAL) permanece com a formula ja existente na linha - nao mexer
        .Cells(r, "U").Value = wsCad.Range("C" & CAD_DATA).Value
        .Cells(r, "U").NumberFormat = "DD/MM/YYYY"
        .Cells(r, "V").Value = wsCad.Range("C" & CAD_STATUS).Value
    End With

    MsgBox "Lancamento adicionado na linha " & r & " da aba HISTORICO.", vbInformation, "Adicionado"

    ' limpa apenas os campos que variam por lancamento (mantem NOTA/MEDICAO/OBRA/etc
    ' para agilizar o proximo lancamento da mesma medicao)
    Dim limpar As Variant
    limpar = Array(CAD_ITEM, CAD_DESCRICAO, CAD_QTD, CAD_X, CAD_Y, CAD_Z, CAD_STATUS)
    For i = LBound(limpar) To UBound(limpar)
        wsCad.Range("C" & limpar(i)).ClearContents
    Next i
End Sub
