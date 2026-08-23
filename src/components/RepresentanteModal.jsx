import { useState } from "react";
import { X } from "lucide-react";
import { formatCpf } from "../lib/cpf.js";

export default function RepresentanteModal({ onClose, onSubmit, representante = null }) {
  const isEditing = Boolean(representante);
  const [nome, setNome] = useState(representante?.nome || "");
  const [email, setEmail] = useState(representante?.email || "");
  const [cpf, setCpf] = useState(representante?.cpf || "");
  const [tipo, setTipo] = useState(representante?.tipo || "socio");
  const [error, setError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    if (!nome.trim()) {
      setError("Informe o nome do representante.");
      return;
    }
    onSubmit({ nome, email, cpf, tipo });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-[2px]">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl bg-surface-card p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wide text-accent-600">
              {isEditing ? "Editar cadastro" : "Novo cadastro"}
            </span>
            <h2 className="mt-1 text-lg font-medium text-ink-900">{isEditing ? "Editar representante" : "Cadastrar representante"}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1 text-ink-400 hover:bg-surface-muted hover:text-ink-900"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 text-[13px] text-ink-600">
          Tipo
          <div className="mt-1 flex rounded-md border border-line-strong p-0.5">
            {[
              { value: "socio", label: "Sócio", hint: "Representante/sócio da empresa" },
              { value: "contador", label: "Contador", hint: "Responsável contábil da empresa" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTipo(option.value)}
                title={option.hint}
                className={`flex-1 rounded px-3 py-1.5 text-[12.5px] transition-colors ${
                  tipo === option.value ? "bg-accent-500 text-white" : "text-ink-600 hover:bg-surface-muted"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-4 block text-[13px] text-ink-600">
          Nome *
          <input
            autoFocus
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            placeholder="Ex.: Maria Souza"
            className="mt-1 w-full rounded-md border border-line-strong px-3 py-2 text-sm outline-none focus:border-accent-500"
          />
        </label>

        <label className="mt-3 block text-[13px] text-ink-600">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="nome@email.com"
            className="mt-1 w-full rounded-md border border-line-strong px-3 py-2 text-sm outline-none focus:border-accent-500"
          />
        </label>

        <label className="mt-3 block text-[13px] text-ink-600">
          CPF
          <input
            value={cpf}
            onChange={(event) => setCpf(formatCpf(event.target.value))}
            placeholder="000.000.000-00"
            inputMode="numeric"
            className="mt-1 w-full rounded-md border border-line-strong px-3 py-2 text-sm outline-none focus:border-accent-500"
          />
        </label>

        {error && <p className="mt-3 text-[12px] text-danger-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-line-strong px-3.5 py-2 text-[13px] text-ink-600 hover:bg-surface-muted"
          >
            Cancelar
          </button>
          <button type="submit" className="rounded-md bg-accent-500 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-accent-600">
            {isEditing ? "Salvar alterações" : "Cadastrar representante"}
          </button>
        </div>
      </form>
    </div>
  );
}
