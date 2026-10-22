// Deixa o código do app (feito para o Vite/navegador) rodar no Node nos
// testes: troca import.meta.env por valores de teste e ignora imports de
// CSS/imagens. Usado via `node --import ./tests/register.mjs`.
export async function resolve(specifier, context, next) {
  if (/\.(css|svg|png|jpe?g|woff2?)(\?.*)?$/.test(specifier)) return { url: "data:text/javascript,export default ''", shortCircuit: true };
  return next(specifier, context);
}

export async function load(url, context, next) {
  const result = await next(url, context);
  if (url.includes("/src/") && result.source) {
    const source = String(result.source).replace(/import\.meta\.env/g, '({VITE_SUPABASE_URL:"http://supabase.test",VITE_SUPABASE_ANON_KEY:"anon",DEV:false,PROD:false})');
    return { ...result, source };
  }
  return result;
}
