import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { FullPageSpinner } from "@/components/ui/Misc";
import { TotalsSummary } from "@/components/ui/TotalsSummary";
import { ClientPicker } from "@/components/pickers/ClientPicker";
import { VehiclePicker } from "@/components/pickers/VehiclePicker";
import { NoteItemsTable } from "@/components/notes/NoteItemsTable";
import {
  createNote,
  getNote,
  suggestNextNoteNumber,
  updateNote,
  type NoteItemDraft,
} from "@/lib/api/notes";
import { calcTotals, noteBalance } from "@/lib/calc";
import { formatCurrency, parseCurrencyInput, todayISO } from "@/lib/format";
import type { NoteStatus } from "@/types/database";
import { useToast } from "@/contexts/ToastContext";
import { ArrowLeft, Loader2, Save } from "@/components/icons";

const PAYMENT_METHODS = [
  "Dinheiro",
  "PIX",
  "Cartão de Crédito",
  "Cartão de Débito",
  "Boleto",
  "Transferência",
];

export default function NoteForm() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { push } = useToast();

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const [numero, setNumero] = useState("");
  const [serie, setSerie] = useState("1");
  const [data, setData] = useState(todayISO());
  const [chaveAcesso, setChaveAcesso] = useState("");
  const [status, setStatus] = useState<NoteStatus>("aberta");
  const [observacoes, setObservacoes] = useState("");
  const [clientId, setClientId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [condicaoPagamento, setCondicaoPagamento] = useState("À vista");
  const [parcelas, setParcelas] = useState(1);
  const [valorPago, setValorPago] = useState(0);
  const [items, setItems] = useState<NoteItemDraft[]>([
    { codigo: "", descricao: "", tipo: "peca", quantidade: 1, unidade: "un", valor_unitario: 0, desconto: 0 },
  ]);

  useEffect(() => {
    if (!id) {
      const presetClient = searchParams.get("client_id");
      if (presetClient) setClientId(presetClient);
      suggestNextNoteNumber()
        .then(setNumero)
        .catch(() => setNumero("0001"));
      return;
    }
    getNote(id).then((note) => {
      if (!note) {
        push("Nota não encontrada.", "error");
        navigate("/notas");
        return;
      }
      setNumero(note.numero);
      setSerie(note.serie);
      setData(note.data);
      setChaveAcesso(note.chave_acesso || "");
      setStatus(note.status);
      setObservacoes(note.observacoes || "");
      setClientId(note.client_id);
      setVehicleId(note.vehicle_id || "");
      setFormaPagamento(note.forma_pagamento || "");
      setCondicaoPagamento(note.condicao_pagamento || "À vista");
      setParcelas(note.parcelas || 1);
      setValorPago(note.valor_pago || 0);
      setItems(
        (note.items || []).map((item) => ({
          id: item.id,
          codigo: item.codigo || "",
          descricao: item.descricao,
          tipo: item.tipo,
          quantidade: item.quantidade,
          unidade: item.unidade,
          valor_unitario: item.valor_unitario,
          desconto: item.desconto,
        }))
      );
      setLoading(false);
    }).catch((err) => {
      push(err instanceof Error ? err.message : "Erro ao carregar nota.", "error");
      navigate("/notas");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const totals = calcTotals(items);
  const saldo = noteBalance(totals.total, valorPago);

  async function handleSubmit() {
    if (!clientId) {
      push("Selecione o cliente da nota.", "error");
      return;
    }
    if (!numero.trim()) {
      push("Informe o número da nota.", "error");
      return;
    }
    const validItems = items.filter((i) => i.descricao.trim());
    if (validItems.length === 0) {
      push("Adicione ao menos um item à nota.", "error");
      return;
    }
    setSaving(true);
    try {
      const header = {
        numero: numero.trim(),
        serie: serie.trim() || "1",
        data,
        chave_acesso: chaveAcesso || null,
        status,
        observacoes: observacoes || null,
        client_id: clientId,
        vehicle_id: vehicleId || null,
        forma_pagamento: formaPagamento || null,
        condicao_pagamento: condicaoPagamento || null,
        parcelas,
        valor_pago: valorPago,
      };
      if (isEdit && id) {
        await updateNote(id, header, validItems);
        push("Nota atualizada com sucesso.");
        navigate(`/notas/${id}`);
      } else {
        const created = await createNote(header, validItems);
        push("Nota criada com sucesso.");
        navigate(`/notas/${created.id}`);
      }
    } catch (err) {
      push(err instanceof Error ? err.message : "Erro ao salvar nota.", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <FullPageSpinner />;

  return (
    <div>
      <button
        onClick={() => navigate("/notas")}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-brand-black"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para Notas Fiscais
      </button>

      <PageHeader
        title={isEdit ? `Editar Nota ${numero}` : "Nova Nota Fiscal"}
        actions={
          <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Nota
          </button>
        }
      />

      <div className="card mb-6 p-5">
        <h3 className="section-title mb-4">Dados da Nota</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="field">
            <label className="label">Número *</label>
            <input className="input" value={numero} onChange={(e) => setNumero(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Série</label>
            <input className="input" value={serie} onChange={(e) => setSerie(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Data</label>
            <input
              type="date"
              className="input"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label">Status</label>
            <select
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value as NoteStatus)}
            >
              <option value="aberta">Aberta</option>
              <option value="paga">Paga</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>
          <div className="field sm:col-span-2">
            <label className="label">Chave de Acesso</label>
            <input
              className="input"
              value={chaveAcesso}
              onChange={(e) => setChaveAcesso(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div className="field sm:col-span-2">
            <label className="label">Observações</label>
            <input
              className="input"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card mb-6 p-5">
        <h3 className="section-title mb-4">Cliente e Veículo</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="field">
            <label className="label">Cliente *</label>
            <ClientPicker
              value={clientId}
              onChange={(clId) => {
                setClientId(clId);
                setVehicleId("");
              }}
            />
          </div>
          <div className="field">
            <label className="label">Veículo</label>
            <VehiclePicker value={vehicleId} onChange={setVehicleId} clientId={clientId || undefined} />
          </div>
        </div>
      </div>

      <div className="card mb-6 p-5">
        <h3 className="section-title mb-4">Itens</h3>
        <NoteItemsTable items={items} onChange={setItems} />
      </div>

      <div className="card mb-6 p-5">
        <h3 className="section-title mb-4">Pagamento</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="field">
            <label className="label">Forma de Pagamento</label>
            <select
              className="input"
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value)}
            >
              <option value="">Selecione...</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label">Condição</label>
            <select
              className="input"
              value={condicaoPagamento}
              onChange={(e) => setCondicaoPagamento(e.target.value)}
            >
              <option value="À vista">À vista</option>
              <option value="Parcelado">Parcelado</option>
            </select>
          </div>
          <div className="field">
            <label className="label">Nº de Parcelas</label>
            <input
              type="number"
              min={1}
              className="input"
              value={parcelas}
              disabled={condicaoPagamento !== "Parcelado"}
              onChange={(e) => setParcelas(Number(e.target.value) || 1)}
            />
          </div>
          <div className="field">
            <label className="label">Valor Pago</label>
            <input
              className="input"
              value={valorPago === 0 ? "" : formatCurrency(valorPago)}
              placeholder="R$ 0,00"
              onChange={(e) => setValorPago(parseCurrencyInput(e.target.value))}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col items-end gap-4">
        <TotalsSummary
          subtotal={totals.subtotal}
          desconto={totals.desconto}
          total={totals.total}
          extraRows={[
            { label: "Valor Pago", value: formatCurrency(valorPago) },
            { label: "Saldo", value: formatCurrency(saldo) },
          ]}
        />
        <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Nota
        </button>
      </div>
    </div>
  );
}
