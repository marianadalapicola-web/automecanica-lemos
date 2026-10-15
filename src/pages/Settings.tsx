import { useEffect, useRef, useState } from 'react';
import { useApp } from '../store/AppContext';
import { Modal, useConfirm, useToast } from '../components/ui';
import { Icon } from '../components/Icon';
import * as ops from '../data/ops';
import type { Category, Settings as S } from '../data/types';
import { downloadFile, makeBackup, transactionsToCSV, validateBackup } from '../lib/backup';
import { effectiveStatus } from '../lib/finance';
import { cloudConfigured } from '../store/supabaseClient';
import { formatDate } from '../lib/dates';

export default function Settings() {
  const { data, update, mode, user, lastSaved, signOut, wipeAll, deleteAccount, today } = useApp();
  const toast = useToast();
  const confirm = useConfirm();
  const [s, setS] = useState<S>(data.settings);
  const [catEdit, setCatEdit] = useState<Category | 'new' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [notifPerm, setNotifPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');

  useEffect(() => setS(data.settings), [data.settings]);
  const dirty = JSON.stringify(s) !== JSON.stringify(data.settings);

  const saveSettings = () => update((d) => ops.saveSettings(d, s), 'Preferências salvas ✧');

  const exportCSV = () => {
    const lbl = { paid: 'Pago', pending: 'Pendente', overdue: 'Vencido' };
    const txs = [...data.transactions].sort((a, b) => a.competenceDate.localeCompare(b.competenceDate));
    downloadFile(`glossy-money-transacoes-${today}.csv`, transactionsToCSV(data, txs, (t) => (t.type === 'transfer' ? 'Transferência' : lbl[effectiveStatus(data, t, today)])), 'text/csv;charset=utf-8');
  };
  const exportJSON = () => downloadFile(`glossy-money-backup-${today}.json`, JSON.stringify(makeBackup(data), null, 2), 'application/json');

  const restore = async (file: File) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      toast('O arquivo não é um JSON válido.', 'error');
      return;
    }
    const r = validateBackup(parsed);
    if (!r.ok) {
      toast(`Backup inválido: ${r.errors.slice(0, 3).join(' ')}`, 'error');
      return;
    }
    const yes = await confirm({
      title: 'Restaurar backup?',
      message: (
        <>
          O backup contém <strong>{r.summary}</strong>. Todos os dados atuais {mode === 'cloud' ? 'da sua conta na nuvem' : 'deste navegador'} serão
          <strong> substituídos</strong>. Recomendamos exportar um backup atual antes.
        </>
      ),
      confirmLabel: 'Restaurar',
      danger: true,
      typeToConfirm: 'RESTAURAR',
    });
    if (yes) update(() => r.data, 'Backup restaurado ✧');
  };

  const wipe = async () => {
    const yes = await confirm({
      title: 'Excluir todos os dados?',
      message: 'Transações, contas, cartões, metas, orçamentos e configurações serão apagados permanentemente. Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir tudo',
      danger: true,
      typeToConfirm: 'EXCLUIR',
    });
    if (!yes) return;
    setBusy(true);
    try {
      await wipeAll();
      toast('Todos os dados foram excluídos.', 'info');
    } catch (e) {
      toast('Erro ao excluir: ' + (e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const removeAccount = async () => {
    const yes = await confirm({
      title: 'Excluir sua conta?',
      message: 'Sua conta de acesso e todos os dados financeiros serão excluídos permanentemente.',
      confirmLabel: 'Excluir conta',
      danger: true,
      typeToConfirm: 'EXCLUIR',
    });
    if (!yes) return;
    setBusy(true);
    try {
      await deleteAccount();
      toast('Conta excluída. Até logo ♡', 'info');
    } catch (e) {
      toast('Erro ao excluir conta: ' + (e as Error).message, 'error');
      setBusy(false);
    }
  };

  const delCat = async (c: Category) => {
    const n = data.transactions.filter((t) => t.categoryId === c.id).length;
    const yes = await confirm({
      title: 'Excluir categoria?',
      message: n ? `${n} lançamento(s) ficarão “sem categoria” e o limite de orçamento desta categoria será removido.` : `A categoria “${c.name}” será excluída.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (yes) update((d) => ops.deleteCategory(d, c.id), 'Categoria excluída');
  };

  const askNotif = async () => {
    if (typeof Notification === 'undefined') return;
    const p = await Notification.requestPermission();
    setNotifPerm(p);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Configurações</h1>
          <p className="sub">Perfil, preferências e seus dados</p>
        </div>
      </div>

      <div className="grid two">
        <section className="card stack">
          <h2>Perfil e preferências</h2>
          <label className="field"><span>Como quer ser chamada(o)?</span><input className="input" value={s.displayName} onChange={(e) => setS({ ...s, displayName: e.target.value })} maxLength={40} /></label>
          <div className="field"><span>Tema visual</span>
            <div className="segmented" role="group" aria-label="Tema">
              {([['pearl', 'Pérola'], ['lilac', 'Lilás'], ['midnight', 'Meia-noite']] as const).map(([k, l]) => (
                <button key={k} aria-pressed={s.theme === k} onClick={() => setS({ ...s, theme: k })}>{l}</button>
              ))}
            </div>
          </div>
          <div className="form-grid cols">
            <label className="field"><span>Moeda</span><select className="input" value="BRL" disabled><option value="BRL">Real (R$ — BRL)</option></select></label>
            <label className="field"><span>Formato de data</span><select className="input" value="DD/MM/AAAA" disabled><option>DD/MM/AAAA</option></select></label>
          </div>
          <label className="field"><span>Primeiro dia do mês financeiro</span>
            <select className="input" value={s.monthStartDay} onChange={(e) => setS({ ...s, monthStartDay: Number(e.target.value) })}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d === 1 ? 'Dia 1 (mês civil)' : `Dia ${d}`}</option>)}
            </select>
          </label>
          <p className="tiny muted">Ex.: se você recebe no dia 5, escolha 5 — o “mês de outubro” irá de 05/10 a 04/11 em todo o app.</p>
          <label className="check"><input type="checkbox" checked={s.reduceMotion} onChange={(e) => setS({ ...s, reduceMotion: e.target.checked })} /> Reduzir animações</label>
        </section>

        <section className="card stack">
          <h2>Notificações</h2>
          <p className="small muted">Os alertas aparecem no dashboard (Money check e Próximos vencimentos) sempre que você abre o app.</p>
          <label className="check"><input type="checkbox" checked={s.notifications.dueSoon} onChange={(e) => setS({ ...s, notifications: { ...s.notifications, dueSoon: e.target.checked } })} /> Avisar sobre contas a vencer</label>
          <label className="field"><span>Antecedência (dias)</span>
            <input type="number" min={1} max={15} className="input" value={s.notifications.daysBefore} onChange={(e) => setS({ ...s, notifications: { ...s.notifications, daysBefore: Math.max(1, Math.min(15, Number(e.target.value) || 1)) } })} />
          </label>
          <label className="check"><input type="checkbox" checked={s.notifications.overdue} onChange={(e) => setS({ ...s, notifications: { ...s.notifications, overdue: e.target.checked } })} /> Avisar sobre contas vencidas</label>
          <label className="check"><input type="checkbox" checked={s.notifications.budgetAlerts} onChange={(e) => setS({ ...s, notifications: { ...s.notifications, budgetAlerts: e.target.checked } })} /> Alertas de orçamento (80% e 100%)</label>
          <div className="form-note">
            Notificações do navegador: <strong>{notifPerm === 'granted' ? 'permitidas' : notifPerm === 'denied' ? 'bloqueadas no navegador' : notifPerm === 'unsupported' ? 'não suportadas' : 'não solicitadas'}</strong>.
            Elas são exibidas quando o app é aberto (não há servidor de push enviando avisos com o app fechado).
            {notifPerm === 'default' && <> <button className="btn sm" onClick={askNotif} style={{ marginLeft: 8 }}>Permitir</button></>}
          </div>
        </section>
      </div>
      {dirty && (
        <div className="banner info" style={{ position: 'sticky', bottom: 90, zIndex: 5, boxShadow: 'var(--shadow)' }}>
          <span className="grow">Você tem alterações nas preferências.</span>
          <button className="btn sm" onClick={() => setS(data.settings)}>Descartar</button>
          <button className="btn sm primary" onClick={saveSettings}>Salvar preferências</button>
        </div>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Categorias</h2>
          <button className="btn sm primary" onClick={() => setCatEdit('new')}><Icon name="plus" size={16} /> Nova categoria</button>
        </div>
        <div className="grid two">
          {(['expense', 'income'] as const).map((k) => (
            <div key={k}>
              <h3 style={{ marginBottom: 8 }}>{k === 'expense' ? 'Despesas' : 'Receitas'}</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {data.categories.filter((c) => c.kind === k).map((c) => (
                  <li key={c.id} className="row between" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span>{c.icon} {c.name} {k === 'expense' && <span className="chip" style={{ marginLeft: 6 }}>{c.fixed ? 'fixa' : 'variável'}</span>}</span>
                    <span className="row" style={{ gap: 0 }}>
                      <button className="icon-btn" onClick={() => setCatEdit(c)} aria-label={`Editar ${c.name}`}><Icon name="edit" size={16} /></button>
                      <button className="icon-btn" onClick={() => delCat(c)} aria-label={`Excluir ${c.name}`}><Icon name="trash" size={16} /></button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="card stack">
        <h2>Gerenciamento de dados</h2>
        <div className="row wrap">
          <button className="btn" onClick={exportCSV}><Icon name="download" /> Exportar transações (CSV)</button>
          <button className="btn" onClick={exportJSON}><Icon name="download" /> Backup completo (JSON)</button>
          <button className="btn" onClick={() => fileRef.current?.click()}><Icon name="upload" /> Restaurar backup</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void restore(f); e.target.value = ''; }} />
        </div>
        <p className="tiny muted">O CSV usa “;” como separador e vírgula decimal, abrindo direto no Excel/Planilhas em português. O backup é validado antes de restaurar.</p>
        <div><button className="btn danger" onClick={wipe} disabled={busy}><Icon name="trash" /> Excluir todos os dados</button></div>
      </section>

      <section className="card stack" id="conta">
        <h2>Conta e sincronização</h2>
        {mode === 'cloud' ? (
          <>
            <p>Conectada(o) como <strong>{user?.email}</strong>. Seus dados ficam no banco remoto e aparecem em qualquer dispositivo em que você entrar com este e-mail.</p>
            <p className="small muted">Último salvamento na nuvem: {lastSaved ? `${formatDate(lastSaved.slice(0, 10))} às ${new Date(lastSaved).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '—'}</p>
            <div className="row wrap">
              <button className="btn" onClick={() => void signOut()}><Icon name="logout" /> Sair da conta</button>
              <button className="btn danger" onClick={removeAccount} disabled={busy}>Excluir minha conta</button>
            </div>
          </>
        ) : !cloudConfigured ? (
          <>
            <h3 style={{ marginTop: -4 }}>Onde ficam seus dados</h3>
            <p className="small">
              Seus dados ficam salvos <strong>neste navegador, neste aparelho</strong> — não há login nem envio para a internet.
              Por isso, o que você lança no celular não aparece no computador (e vice-versa), e limpar os dados do navegador apaga tudo.
            </p>
            <p className="small">
              ✧ Faça um <strong>backup JSON</strong> de vez em quando (em “Gerenciamento de dados”, acima). Para usar em outro aparelho,
              restaure esse backup lá.
            </p>
          </>
        ) : (
          <>
            <div className="banner demo">
              Modo demonstração: os dados ficam apenas neste navegador, não são sincronizados e podem ser perdidos se o histórico/armazenamento do navegador for limpo.
            </div>
            {cloudConfigured ? (
              <p className="small">Para sincronizar entre celular e computador, saia do modo demonstração e crie uma conta. Você pode levar seus dados exportando um backup aqui e restaurando-o depois de entrar.</p>
            ) : (
              <p className="small">A sincronização na nuvem ainda não foi configurada nesta instalação (variáveis do Supabase ausentes). Veja o README do projeto.</p>
            )}
            <div className="row wrap">
              <button className="btn" onClick={() => void signOut()}><Icon name="logout" /> Sair do modo demonstração</button>
              <button className="btn danger" onClick={removeAccount} disabled={busy}>Apagar dados da demonstração</button>
            </div>
          </>
        )}
      </section>

      {catEdit && <CategoryForm cat={catEdit === 'new' ? undefined : catEdit} onClose={() => setCatEdit(null)} />}
    </>
  );
}

function CategoryForm({ cat, onClose }: { cat?: Category; onClose: () => void }) {
  const { update } = useApp();
  const [name, setName] = useState(cat?.name ?? '');
  const [kind, setKind] = useState<Category['kind']>(cat?.kind ?? 'expense');
  const [icon, setIcon] = useState(cat?.icon ?? '✨');
  const [fixed, setFixed] = useState(cat?.fixed ?? false);
  const save = () => {
    if (update((d) => ops.saveCategory(d, { id: cat?.id, name, kind, icon: icon.trim() || '•', fixed }), cat ? 'Categoria atualizada' : 'Categoria criada ✧')) onClose();
  };
  return (
    <Modal title={cat ? 'Editar categoria' : 'Nova categoria'} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={save}>Salvar</button></>}>
      <form className="form-grid cols" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <label className="field span2"><span>Nome</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></label>
        <label className="field"><span>Tipo</span>
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as Category['kind'])} disabled={!!cat}>
            <option value="expense">Despesa</option><option value="income">Receita</option>
          </select>
        </label>
        <label className="field"><span>Ícone (emoji)</span><input className="input" value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} /></label>
        {kind === 'expense' && <label className="check span2"><input type="checkbox" checked={fixed} onChange={(e) => setFixed(e.target.checked)} /> Despesa fixa (aluguel, assinaturas…)</label>}
        <button hidden type="submit" />
      </form>
    </Modal>
  );
}
