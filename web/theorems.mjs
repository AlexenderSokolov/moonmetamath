// Collect bounded metadata pages without transferring original proofs.
export async function readTheorems(request, database_id) {
  const theorems = [];
  let total = 0;
  do {
    const response = await request('theorems', { database_id, offset: theorems.length, limit: 100 });
    if (response.status !== 'ok') throw new Error(response.diagnostics?.map(item => item.message).join('; ') || 'Theorem query failed');
    const page = response.data;
    total = page.total;
    if (!Array.isArray(page.theorems) || !Number.isInteger(total) || total < 0 || (!page.theorems.length && theorems.length < total)) throw new Error('Invalid theorem page');
    theorems.push(...page.theorems);
  } while (theorems.length < total);
  return { data: { theorems } };
}
