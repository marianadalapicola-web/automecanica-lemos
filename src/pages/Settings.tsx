import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FullPageSpinner } from "@/components/ui/Misc";
import { Modal } from "@/components/ui/Modal";
import { getSettings, updateSettings } from "@/lib/api/settings";
import { createUserAccount, listProfiles, updateProfileRole } from "@/lib/api/users";
import type { Profile, Settings as SettingsType, UserRole } from "@/types/database";
import { maskDocumento, maskPhone } from "@/lib/format";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import { Save, Loader2, ShieldCheck, UserPlus, Building2 } from "@/components/icons";

const BRAZILIAN_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB",
  "PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

export default function Settings() {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { push } = useToast();
  const { profile } = useAuth();

  const [form, setForm] = useState({
    nome_oficina: "",
    razao_social: "",
    cnpj: "",
    telefone: "",
    whatsapp: "",
    email: "",
    endereco: "",
    cep: "",
    cidade: "",
    estado: "",
    logo_url: "",
  });

  useEffect(() => {
    getSettings()
      .then((data) => {
        setSettings(data);
        setForm({
          nome_oficina: data.nome_oficina || "AUTOMECÂNICA LEMOS",
          razao_social: data.razao_social || "",
          cnpj: data.cnpj || "",
          telefone: data.telefone || "",
          whatsapp: data.whatsapp || "",
          email: data.email || "",
          endereco: data.endereco || "",
          cep: data.cep || "",
          cidade: data.cidade || "",
          estado: data.estado || "",
          logo_url: data.logo_url || "",
        });
      })
      .catch((err) =>
        push(err instanceof Error ? err.message : "Erro ao carregar configurações.", "error")
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSettings(form);
      push("Configurações atualizadas com sucesso.");
    } catch (err) {
      push(err instanceof Error ? err.message : "Erro ao salvar configurações.", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settings) return <FullPageSpinner />;

  return (
    <div>
      <PageHeader
        title="Configurações"
        subtitle="Dados da oficina utilizados no sistema e nos PDFs"
      />

      <form onSubmit={handleSave} className="card mb-6 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-brand-red" />
          <h3 className="section-title">Dados da Oficina</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="field lg:col-span-2">
            <label className="label">Nome da Oficina</label>
            <input
              className="input"
              value={form.nome_oficina}
              onChange={(e) => set("nome_oficina", e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label">CNPJ</label>
            <input
              className="input"
              value={form.cnpj}
              onChange={(e) => set("cnpj", maskDocumento(e.target.value))}
            />
          </div>
          <div className="field lg:col-span-2">
            <label className="label">Razão Social</label>
            <input
              className="input"
              value={form.razao_social}
              onChange={(e) => set("razao_social", e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label">URL do Logo</label>
            <input
              className="input"
              value={form.logo_url}
              onChange={(e) => set("logo_url", e.target.value)}
              placeholder="https://... ou data:image/png;base64,..."
            />
          </div>
          <div className="field">
            <label className="label">Telefone</label>
            <input
              className="input"
              value={form.telefone}
              onChange={(e) => set("telefone", maskPhone(e.target.value))}
            />
          </div>
          <div className="field">
            <label className="label">WhatsApp</label>
            <input
              className="input"
              value={form.whatsapp}
              onChange={(e) => set("whatsapp", maskPhone(e.target.value))}
            />
          </div>
          <div className="field">
            <label className="label">E-mail</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div className="field lg:col-span-2">
            <label className="label">Endereço</label>
            <input
              className="input"
              value={form.endereco}
              onChange={(e) => set("endereco", e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label">CEP</label>
            <input className="input" value={form.cep} onChange={(e) => set("cep", e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Cidade</label>
            <input
              className="input"
              value={form.cidade}
              onChange={(e) => set("cidade", e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label">Estado</label>
            <select
              className="input"
              value={form.estado}
              onChange={(e) => set("estado", e.target.value)}
            >
              <option value="">Selecione...</option>
              {BRAZILIAN_STATES.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Configurações
          </button>
        </div>
      </form>

      {profile?.role === "admin" && <UsersSection />}
    </div>
  );
}

function UsersSection() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const { push } = useToast();

  async function load() {
    setLoading(true);
    try {
      setUsers(await listProfiles());
    } catch (err) {
      push(err instanceof Error ? err.message : "Erro ao carregar usuários.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRoleChange(id: string, role: UserRole) {
    try {
      await updateProfileRole(id, role);
      push("Nível de acesso atualizado.");
      await load();
    } catch (err) {
      push(err instanceof Error ? err.message : "Erro ao atualizar usuário.", "error");
    }
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-brand-red" />
          <h3 className="section-title">Usuários do Sistema</h3>
        </div>
        <button className="btn-secondary btn-sm" onClick={() => setModalOpen(true)}>
          <UserPlus className="h-3.5 w-3.5" /> Novo Usuário
        </button>
      </div>

      {loading ? (
        <FullPageSpinner />
      ) : (
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Nível de Acesso</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="font-medium text-brand-black">{u.nome}</td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      className="input max-w-[180px]"
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                    >
                      <option value="admin">Administrador</option>
                      <option value="funcionario">Funcionário</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NewUserModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={load} />
    </div>
  );
}

function NewUserModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("funcionario");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { push } = useToast();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("A senha deve ter ao menos 6 caracteres.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await createUserAccount({ email, password, nome, role });
      push("Usuário criado com sucesso.");
      setNome("");
      setEmail("");
      setPassword("");
      setRole("funcionario");
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar usuário.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title="Novo Usuário" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="field">
          <label className="label">Nome</label>
          <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} required />
        </div>
        <div className="field">
          <label className="label">E-mail</label>
          <input
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label className="label">Senha</label>
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        <div className="field">
          <label className="label">Nível de Acesso</label>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            <option value="funcionario">Funcionário</option>
            <option value="admin">Administrador</option>
          </select>
        </div>

        {error && <p className="text-sm font-medium text-brand-red">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar Usuário
          </button>
        </div>
      </form>
    </Modal>
  );
}
