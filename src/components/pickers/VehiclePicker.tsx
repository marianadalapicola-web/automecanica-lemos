import { useEffect, useRef, useState } from "react";
import { listVehicles, listVehiclesByClient, createVehicle } from "@/lib/api/vehicles";
import type { Vehicle } from "@/types/database";
import { Modal } from "@/components/ui/Modal";
import { VehicleForm, VehicleFormValues } from "@/components/forms/VehicleForm";
import { useToast } from "@/contexts/ToastContext";
import { Plus, ChevronDown, Car } from "@/components/icons";

export function VehiclePicker({
  value,
  onChange,
  clientId,
}: {
  value: string;
  onChange: (id: string, vehicle?: Vehicle) => void;
  clientId?: string;
}) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { push } = useToast();

  const selected = vehicles.find((v) => v.id === value);

  useEffect(() => {
    let active = true;
    const loader = clientId ? listVehiclesByClient(clientId) : listVehicles();
    loader
      .then((data) => {
        if (active) setVehicles(data);
      })
      .catch(() => {
        if (active) setVehicles([]);
      });
    return () => {
      active = false;
    };
  }, [clientId]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleCreate(values: VehicleFormValues) {
    const vehicle = await createVehicle({
      client_id: values.client_id,
      placa: values.placa,
      marca: values.marca,
      modelo: values.modelo,
      ano: values.ano || null,
      cor: values.cor || null,
      km: values.km ? Number(values.km) : null,
      observacoes: values.observacoes || null,
    });
    push("Veículo cadastrado com sucesso.");
    setVehicles((prev) => [vehicle, ...prev]);
    onChange(vehicle.id, vehicle);
    setModalOpen(false);
    setOpen(false);
  }

  if (!clientId) {
    return (
      <div className="input flex items-center text-neutral-400">
        Selecione um cliente primeiro
      </div>
    );
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input flex items-center justify-between text-left"
      >
        <span className={selected ? "text-brand-black" : "text-neutral-400"}>
          {selected ? `${selected.placa} — ${selected.marca} ${selected.modelo}` : "Selecione um veículo..."}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-neutral-400" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-neutral-200 bg-white shadow-xl">
          <div className="max-h-56 overflow-y-auto py-1">
            {vehicles.length === 0 && (
              <p className="px-3 py-2 text-sm text-neutral-400">
                Nenhum veículo cadastrado para este cliente.
              </p>
            )}
            {vehicles.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  onChange(v.id, v);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-50 ${
                  v.id === value ? "bg-red-50 text-brand-red" : "text-brand-black"
                }`}
              >
                <Car className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                <span className="min-w-0 flex-1 truncate">
                  {v.placa} — {v.marca} {v.modelo}
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
              <Plus className="h-3.5 w-3.5" /> Cadastrar novo veículo
            </button>
          </div>
        </div>
      )}

      <Modal
        open={modalOpen}
        title="Novo Veículo"
        onClose={() => setModalOpen(false)}
      >
        <VehicleForm
          fixedClientId={clientId}
          onSubmit={handleCreate}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
