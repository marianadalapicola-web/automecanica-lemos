import { useEffect, useRef, useState } from "react";
import { listClients, createClient } from "@/lib/api/clients";
import type { Client } from "@/types/database";
import { Modal } from "@/components/ui/Modal";
import { ClientForm, ClientFormValues } from "@/components/forms/ClientForm";
import { useToast } from "@/contexts/ToastContext";
import { Search, Plus, ChevronDown, Users } from "@/components/icons";

export function ClientPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string, client?: Client) => void;
}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { push } = useToast();

  const selected = clients.find((c) => c.id === value);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listClients(query || undefined)
      .then((data) => {
        if (active) setClients(data);
      })
      .catch(() => {
        if (active) setClients([]);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleCreate(values: ClientFormValues) {
    const client = await createClient(values);
    push("Cliente cadastrado com sucesso.");
    setClients((prev) => [client, ...prev]);
    onChange(client.id, client);
    setModalOpen(false);
    setOpen(false);
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input flex items-center justify-between text-left"
      >
        <span className={selected ? "text-brand-black" : "text-neutral-400"}>
          {selected ? selected.nome : "Selecione um cliente..."}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-neutral-400" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-neutral-200 bg-white shadow-xl">
          <div className="border-b border-neutral-100 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar cliente..."
                className="w-full rounded-lg border border-neutral-200 py-1.5 pl-8 pr-2 text-sm outline-none focus:border-brand-red"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {loading && (
              <p className="px-3 py-2 text-sm text-neutral-400">Buscando...</p>
            )}
            {!loading && clients.length === 0 && (
              <p className="px-3 py-2 text-sm text-neutral-400">
                Nenhum cliente encontrado.
              </p>
            )}
            {clients.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onChange(c.id, c);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-50 ${
                  c.id === value ? "bg-red-50 text-brand-red" : "text-brand-black"
                }`}
              >
                <Users className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                <span className="min-w-0 flex-1 truncate">{c.nome}</span>
                <span className="shrink-0 text-xs text-neutral-400">
                  {c.documento}
                </span>
              </button>
            ))}
          </div>
          <div className="border-t border-neutral-100 p-2">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="btn-secondary btn-sm w-full"
            >
              <Plus className="h-3.5 w-3.5" /> Cadastrar novo cliente
            </button>
          </div>
        </div>
      )}

      <Modal
        open={modalOpen}
        title="Novo Cliente"
        onClose={() => setModalOpen(false)}
      >
        <ClientForm onSubmit={handleCreate} onCancel={() => setModalOpen(false)} />
      </Modal>
    </div>
  );
}
