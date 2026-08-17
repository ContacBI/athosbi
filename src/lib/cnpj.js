export function formatCnpj(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function cnpjDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

// Public CNPJ registry lookup (BrasilAPI) — no auth, no personal data,
// just company legal name and primary activity (CNAE) for autofill.
export async function lookupCnpj(value) {
  const digits = cnpjDigits(value);
  if (digits.length !== 14) throw new Error("CNPJ incompleto");
  const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
  if (!response.ok) throw new Error("CNPJ não encontrado");
  const data = await response.json();
  return {
    name: data.razao_social || data.nome_fantasia || "",
    fantasia: data.nome_fantasia || "",
    atividade: data.cnae_fiscal_descricao || "",
    municipio: data.municipio || "",
    uf: data.uf || "",
    situacao: data.descricao_situacao_cadastral || "",
  };
}
