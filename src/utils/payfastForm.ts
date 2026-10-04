function isStringRecord(value: unknown): value is Record<string, string> {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && Object.values(value).every(entry => typeof entry === 'string');
}

export function submitPayFastForm(
  processUrl: unknown,
  fields: unknown,
  targetDocument: Document = document
): void {
  if (typeof processUrl !== 'string' || processUrl.trim() === '') {
    throw new Error('PayFast returned an invalid checkout URL.');
  }
  if (!isStringRecord(fields) || Object.keys(fields).length === 0) {
    throw new Error('PayFast returned invalid checkout fields.');
  }

  const form = targetDocument.createElement('form');
  form.method = 'POST';
  form.action = processUrl;
  form.style.display = 'none';

  Object.entries(fields).forEach(([name, value]) => {
    const field = targetDocument.createElement('input');
    field.type = 'hidden';
    field.name = name;
    field.value = value;
    form.appendChild(field);
  });

  targetDocument.body.appendChild(form);
  try {
    form.submit();
  } catch (error) {
    form.remove();
    throw error;
  }
}
