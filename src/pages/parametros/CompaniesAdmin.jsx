import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "../../data/useStore.js";
import { createCompany, updateCompany, deleteCompany, importBackupFile, exportBackupPayload } from "../../lib/companies.js";
import CompanyModal from "../../components/CompanyModal.jsx";
import Avatar from "../../components/Avatar.jsx";
import PageHeader from "../../components/PageHeader.jsx";
import { Building2, Users2, FileSpreadsheet, Pencil, Trash2, Repeat, SlidersHorizontal, Download, Upload, ArrowRight } from "lucide-react";

function downloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function CompaniesAdmin() {
  const state = useAppState();
  const navigate = useNavigate();
  const [modalCompany, setModalCompany] = useState(undefined); // undefined = fechado, null = criar, objeto = editar
  const [busy, setBusy] = useState("");
  const backupInput = useRef(null);

  function handleSubmit(fields) {
    if (modalCompany) updateCompany(modalCompany.id, fields);
    else createCompany(fields);
    setModalCompany(undefined);
  }

  async function handleBackupImport(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy("Restaurando backup...");
    try {
      const count = await importBackupFile(file);
      setBusy("");
      alert(`Backup restaurado: ${count} empresa(s).`);
    } catch {
      setBusy("");
      alert("Não consegui ler esse arquivo de backup.");
    }
  }

  function handleBackupExport() {
    downloadJson(exportBackupPayload(), `backup_empresas_portal_${new Date().toISOString().slice(0, 10)}.json`);
  }

  function representanteNames(company) {
    const ids = company.representanteIds || [];
    return state.representantes.filter((representante) => ids.includes(representante.id)).map((representante) => representante.nome);
  }

  const totalLancamentos = state.companies.reduce((sum, company) => sum + (company.journal || []).length, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Carteira"
        title="Empresas cadastradas"
        description="Cadastre, edite ou remova empresas. Backups de toda a carteira também ficam aqui."
        icon={Building2}
      />

      <div className="grid grid-cols-[minmax(0,1fr)_260px] gap-5 max-lg:grid-cols-1">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] font-medium text-ink-900">
              {state.companies.length} empresa{state.companies.length === 1 ? "" : "s"} na carteira
            </p>
            <button
              type="button"
              onClick={() => setModalCompany(null)}
              className="rounded-md bg-accent-500 px-3.5 py-2 text-[13px] font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-accent-600 hover:shadow-md"
            >
              + Nova empresa
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            {state.companies.length === 0 && (
              <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface-card px-6 py-12 text-center shadow-sm">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-50 text-accent-500">
                  <Building2 size={22} strokeWidth={1.6} />
                </span>
                <p className="text-[13px] font-medium text-ink-900">Nenhuma empresa cadastrada ainda</p>
                <p className="text-[12px] text-ink-400">Clique em "+ Nova empresa" acima para começar.</p>
              </div>
            )}
            {state.companies.map((company) => {
              const names = representanteNames(company);
              return (
                <div key={company.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface-card p-3.5 shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex items-center gap-3">
                    <Avatar name={company.name} size={36} />
                    <div>
                      <p className="text-[13px] font-medium text-ink-900">
                        {company.codigo && <span className="mr-1.5 text-ink-400">{company.codigo}</span>}
                        {company.name}
                      </p>
                      <p className="text-[12px] text-ink-400">{company.cnpj || "CNPJ não informado"}</p>
                      {names.length > 0 && <p className="mt-0.5 text-[11px] text-ink-400">Representantes: {names.join(", ")}</p>}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => setModalCompany(company)}
                      aria-label={`Editar ${company.name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-line-strong text-ink-600 hover:bg-surface-muted"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Remover ${company.name} da carteira?`)) deleteCompany(company.id);
                      }}
                      aria-label={`Remover ${company.name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-line-strong text-danger-600 hover:bg-danger-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-xl bg-surface-card p-3.5 shadow-sm">
            <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wide text-ink-400">Visão geral</p>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-2 text-ink-500">
                  <Building2 size={14} strokeWidth={1.8} className="text-accent-500" />
                  Empresas
                </span>
                <span className="font-medium text-ink-900">{state.companies.length}</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-2 text-ink-500">
                  <Users2 size={14} strokeWidth={1.8} className="text-accent-500" />
                  Representantes
                </span>
                <span className="font-medium text-ink-900">{state.representantes.length}</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-2 text-ink-500">
                  <FileSpreadsheet size={14} strokeWidth={1.8} className="text-accent-500" />
                  Lançamentos
                </span>
                <span className="font-medium text-ink-900">{totalLancamentos.toLocaleString("pt-BR")}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-surface-card p-3.5 shadow-sm">
            <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wide text-ink-400">Backup da carteira</p>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={handleBackupExport}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink-700 hover:bg-surface-muted"
              >
                <Download size={14} strokeWidth={1.8} className="text-ink-400" />
                Exportar carteira
              </button>
              <button
                type="button"
                onClick={() => backupInput.current?.click()}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink-700 hover:bg-surface-muted"
              >
                <Upload size={14} strokeWidth={1.8} className="text-ink-400" />
                Restaurar backup
              </button>
              <input ref={backupInput} type="file" accept=".json" className="hidden" onChange={handleBackupImport} />
            </div>
            {busy && <p className="px-2.5 pt-1 text-[11px] text-accent-600">{busy}</p>}
          </div>

          <div className="rounded-xl bg-surface-card p-3.5 shadow-sm">
            <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wide text-ink-400">Atalhos</p>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => navigate("/parametros/de-para")}
                className="flex items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px] text-ink-700 hover:bg-surface-muted"
              >
                <span className="flex items-center gap-2">
                  <Repeat size={14} strokeWidth={1.8} className="text-ink-400" />
                  De/Para
                </span>
                <ArrowRight size={12} className="text-ink-300" />
              </button>
              <button
                type="button"
                onClick={() => navigate("/parametros/representantes")}
                className="flex items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px] text-ink-700 hover:bg-surface-muted"
              >
                <span className="flex items-center gap-2">
                  <Users2 size={14} strokeWidth={1.8} className="text-ink-400" />
                  Representantes
                </span>
                <ArrowRight size={12} className="text-ink-300" />
              </button>
              <button
                type="button"
                onClick={() => navigate("/parametros/sistema")}
                className="flex items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px] text-ink-700 hover:bg-surface-muted"
              >
                <span className="flex items-center gap-2">
                  <SlidersHorizontal size={14} strokeWidth={1.8} className="text-ink-400" />
                  Sistema
                </span>
                <ArrowRight size={12} className="text-ink-300" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {modalCompany !== undefined && (
        <CompanyModal company={modalCompany} onClose={() => setModalCompany(undefined)} onSubmit={handleSubmit} />
      )}
    </div>
  );
}
