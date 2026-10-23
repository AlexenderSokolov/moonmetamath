// Pure policy boundary. No filesystem, core handles, raw sources or proof arrays.
const tokens = value => {
  if(!Array.isArray(value)||value.some(x=>typeof x!=='string')) throw new Error('Expected token array');
  return value.map(x=>x);
};
const hypothesis = value => ({label:String(value.label),expression:tokens(value.expression)});
const ruleHypothesis = value => ({label:String(value.label),kind:String(value.kind),expression:tokens(value.expression)});
export const LIMITS = Object.freeze({max_calls:2,max_actions_per_call:64,call_timeout_ms:120000,task_timeout_ms:240000});
export const RESPONSE_SCHEMA = Object.freeze({
  type:'object',additionalProperties:false,required:['actions'],properties:{actions:{type:'array',maxItems:64,items:{
    type:'object',additionalProperties:false,required:['operation','label'],properties:{operation:{type:'string',enum:['apply_label']},label:{type:'string'}}
  }}}
});
export const POLICY_INSTRUCTIONS = `Complete the supplied Metamath proof from the current stack. Return ONLY JSON matching the response schema, with up to 64 apply_label actions. The bottom of the stack is first. A $f or $e rule pushes its conclusion. For an assertion ($a or $p), mandatory_hypotheses consume stack entries in the listed order: $f entries bind variables to token sequences, and $e entries must match the substituted expressions. Push the substituted conclusion. The final stack must contain exactly the goal. Use only available_rules labels. You may use multiple applications of a label. Do not request tools, files, sources, replay, target proofs or additional operations. You have at most two calls total; the next call, if needed, contains current stack and safe error codes. Empty actions gives up this call. These are tiny self-authored exercises, not new mathematics.`;

// Rebuild every nested record; legacy list data has no `rules` and yields no rules.
export function observe(view, rulePage, feedback=[]) {
  return {
    goal:tokens(view.goal),
    active_hypotheses:(view.active_hypotheses??[]).map(hypothesis),
    stack:(view.stack??[]).map(tokens),
    available_rules:(rulePage.rules??[]).map(r=>({
      label:String(r.label),kind:String(r.kind),conclusion:tokens(r.conclusion),
      mandatory_hypotheses:(r.mandatory_hypotheses??[]).map(ruleHypothesis),
      disjoint:(r.disjoint??[]).map(pair=>tokens(pair)),
    })),
    feedback:feedback.map(f=>({action_index:Number.isSafeInteger(f.action_index)&&f.action_index>=0?f.action_index:0,code:typeof f.code==='string'&&/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(f.code)?f.code:'ExecutionError'})),
  };
}

export function validateResponse(value, labels) {
  const exact=(object,keys)=>object!==null&&typeof object==='object'&&!Array.isArray(object)&&Object.keys(object).length===keys.length&&Object.keys(object).every(k=>keys.includes(k));
  if(!exact(value,['actions'])||!Array.isArray(value.actions)||value.actions.length>LIMITS.max_actions_per_call)throw new Error('Invalid action batch');
  return value.actions.map(a=>{
    if(!exact(a,['operation','label'])||a.operation!=='apply_label'||typeof a.label!=='string'||!labels.has(a.label))throw new Error('Invalid or unavailable action');
    return {operation:'apply_label',label:a.label};
  });
}
