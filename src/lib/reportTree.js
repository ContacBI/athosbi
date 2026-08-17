// Shared helper over buildReportTree() results — finds the immediate
// children of a managerial-plan code (one segment deeper, no further dots),
// used anywhere a card needs to "open up" a total into its parts.
export function directChildren(tree, code) {
  const prefix = `${code}.`;
  return tree.filter((row) => {
    if (!row.codigo_gerencial?.startsWith(prefix)) return false;
    return !row.codigo_gerencial.slice(prefix.length).includes(".");
  });
}
