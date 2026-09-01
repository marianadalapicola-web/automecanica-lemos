import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { FullPageSpinner } from "@/components/ui/Misc";
import { TotalsSummary } from "@/components/ui/TotalsSummary";
import { ClientPicker } from "@/components/pickers/ClientPicker";
import { VehiclePicker } from "@/components/pickers/VehiclePicker";
import { QuoteItemsTable } from "@/components/quotes/QuoteItemsTable";
import {
  createQuote,
  getQuote,
  nextQuoteItem,
  updateQuote,
  type QuoteItemDraft,
} from "@/lib/api/quotes";
import { calcTotals } from "@/lib/calc";
import { todayISO, addDaysISO } from "@/lib/format";
import type { QuoteStatus } from "@/types/database";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Loader2, Save } from "@/components/icons";

export default function QuoteForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { push } = useToast();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [numero, setNumero] = useState<string | null>(null);

  const [data, setData] = useState(todayISO());
  const [validade, setValidade] = useState(addDaysISO(15));
  const [clientId, setClientId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [prazoEntrega, setPrazoEntrega] = useState("");
  const [status, setStatus] = useState<QuoteStatus>("rascunho");
  const [items, setItems] = useState<QuoteItemDraft[]>([nextQuoteItem()]);

  useEffect(() => {
    if (profile?.nome && !isEdit) setResponsavel(profile.nome);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useEffect(() => {
    if (!id) return;
    getQuote(id).then((quote) => {
      if (!quote) {
        push("Cotação não encontrada.", "error");
        navigate("/cotacoes");
        return;
      }
      setNumero(quote.numero);
      setData(quote.data);
      setValidade(quote.validade || "");
      setClientId(quote.client_id);
      setVehicleId(quote.vehicle_id || "");
      setResponsavel(quote.responsavel || "");
      setObservacoes(quote.observacoes || "");
      setFormaPagamento(quote.forma_pagamento || "");
      setPrazoEntrega(quote.prazo_entrega || "");
      setStatus(quote.status);
      setItems(
        (quote.items || []).map((item) => ({
          id: item.id,
          codigo: item.codigo || "",
          descricao: item.descricao,
          tipo: item.tipo,
          marca: item.marca || "",
          quantidade: item.quantidade,
          unidade: item.unidade,
          valor_unitario: item.valor_unitario,
          desconto: item.desconto,
          fornecedor_id:
            (item as unknown as { fornecedor_id: string | null }).fornecedor_id ?? null,
          fornecedor_nome:
            (item as unknown as { fornecedor_nome: string | null }).fornecedor_nome ?? null,
          supplier_options: (item.supplier_options || []).map((opt) => ({
            id: opt.id,
            supplier_id: opt.supplier_id,
            supplier_nome_livre: opt.supplier_nome_livre,
            preco: opt.preco,
            selecionado: opt.selecionado,
          })),
        }))
      );
      setLoading(false);
    }).catch((err) => {
      push(err instanceof Error ? err.message : "Erro ao carregar cotação.", "error");
      navigate("/cotacoes");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const totals = calcTotals(items);

  async function handleSubmit(nextStatus?: QuoteStatus) {
    if (!clientId) {
      push("Selecione o cliente da cotação.", "error");
      return;
    }
    const validItems = items.filter((i) => i.descricao.trim());
    if (validItems.length === 0) {
      push("Adicione ao menos um item à cotação.", "error");
      return;
    }
    setSaving(true);
    try {
      const header = {
        data,
        validade: validade || null,
        client_id: clientId,
        vehicle_id: vehicleId || null,
        responsavel: responsavel || null,
        observacoes: observacoes || null,
        forma_pagamento: formaPagamento || null,
        prazo_entrega: prazoEntrega || null,
        status: nextStatus || status,
      };
      if (isEdit && id) {
        await updateQuote(id, header, validItems);
        push("Cotação atualizada com sucesso.");
      } else {
        const created = await createQuote(header, validItems);
        push("Cotação criada com sucesso.");
        navigate(`/cotacoes/${created.id}`);
        return;
      }
      navigate(`/cotacoes/${id}`);
    } catch (err) {
      push(err instanceof Error ? err.message : "Erro ao salvar cotação.", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <FullPageSpinner />;

  return (
    <div>
      <button
        onClick={() => navigate("/cotacoes")}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-brand-black"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para Cotações
      </button>

      <PageHeader
        title={isEdit ? `Editar Cotação ${numero || ""}` : "Nova Cotação"}
        subtitle={
          isEdit
            ? "Atualize os dados, itens e fornecedores da cotação"
            : "O número será gerado automaticamente ao salvar"
        }
        actions={
          <button
            className="btn-primary"
            onClick={() => handleSubmit()}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Cotação
          </button>
        }
      />

      <div className="card mb-6 p-5">
        <h3 className="section-title mb-4">Dados da Cotação</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="field">
            <label className="label">Número</label>
            <input className="input bg-neutral-50" value={numero || "Gerado automaticamente"} disabled />
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
            <label className="label">Validade</label>
            <input
              type="date"
              className="input"
              value={validade}
              onChange={(e) => setValidade(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label">Status</label>
            <select
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value as QuoteStatus)}
            >
              <option value="rascunho">Rascunho</option>
              <option value="enviada">Enviada</option>
              <option value="aprovada">Aprovada</option>
              <option value="recusada">Recusada</option>
              <option value="expirada">Expirada</option>
            </select>
          </div>
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
          <div className="field">
            <label className="label">Responsável</label>
            <input
              className="input"
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label">Forma de Pagamento</label>
            <input
              className="input"
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value)}
              placeholder="Ex: PIX, Cartão, Boleto"
            />
          </div>
          <div className="field">
            <label className="label">Prazo de Entrega</label>
            <input
              className="input"
              value={prazoEntrega}
              onChange={(e) => setPrazoEntrega(e.target.value)}
              placeholder="Ex: 2 dias úteis"
            />
          </div>
          <div className="field sm:col-span-2 lg:col-span-2">
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
        <h3 className="section-title mb-4">Itens</h3>
        <QuoteItemsTable items={items} onChange={setItems} />
      </div>

      <div className="flex flex-col items-end gap-4">
        <TotalsSummary subtotal={totals.subtotal} desconto={totals.desconto} total={totals.total} />
        <button className="btn-primary" onClick={() => handleSubmit()} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Cotação
        </button>
      </div>
    </div>
  );
}
