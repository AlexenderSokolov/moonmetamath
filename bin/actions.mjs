// Validate the complete action file before applying any prefix.
export function validateActions(value) {
  const object = item => item !== null && typeof item === 'object' && !Array.isArray(item);
  const exactFields = (item, fields) =>
    Object.keys(item).length === fields.length && Object.keys(item).every(key => fields.includes(key));
  let actions;
  if (Array.isArray(value)) actions = value;
  else {
    if (!object(value) || !exactFields(value, ['schema_version', 'actions']) ||
        value.schema_version !== 1 || !Array.isArray(value.actions)) {
      throw new Error('Actions wrapper must contain only schema_version:1 and an actions array.');
    }
    actions = value.actions;
  }
  return actions.map((action, index) => {
    const invalid = message => {
      const error = new Error(`Invalid action at index ${index}: ${message}`);
      error.action_index = index;
      throw error;
    };
    if (!object(action)) invalid('expected an action object.');
    switch (action.operation) {
      case 'apply_label':
        if (!exactFields(action, ['operation', 'label']) || typeof action.label !== 'string') {
          invalid('apply_label requires only operation and a string label.');
        }
        return { operation: 'apply_label', label: action.label };
      case 'rewind':
        if (!exactFields(action, ['operation', 'successful_step_count']) ||
            !Number.isSafeInteger(action.successful_step_count) || action.successful_step_count < 0) {
          invalid('rewind requires only operation and a nonnegative safe integer successful_step_count.');
        }
        return { operation: 'rewind', successful_step_count: action.successful_step_count };
      case 'finish':
        if (!exactFields(action, ['operation'])) invalid('finish permits only operation.');
        return { operation: 'finish' };
      default:
        invalid('operation must be apply_label, rewind or finish.');
    }
  });
}
