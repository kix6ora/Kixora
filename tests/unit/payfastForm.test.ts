import { afterEach, describe, expect, it, vi } from 'vitest';
import { submitPayFastForm } from '../../src/utils/payfastForm';

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('submitPayFastForm', () => {
  it('posts ordered hidden fields to PayFast and submits the appended form', () => {
    const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => undefined);
    const fields = {
      merchant_id: 'merchant',
      m_payment_id: 'KXO-9062',
      signature: 'signature',
    };

    submitPayFastForm('https://sandbox.payfast.co.za/eng/process', fields);

    const form = document.body.querySelector('form');
    expect(form).not.toBeNull();
    expect(form?.method).toBe('post');
    expect(form?.action).toBe('https://sandbox.payfast.co.za/eng/process');
    expect(form?.style.display).toBe('none');
    expect(Array.from(form?.querySelectorAll('input') ?? []).map(input => ({
      type: input.type,
      name: input.name,
      value: input.value,
    }))).toEqual([
      { type: 'hidden', name: 'merchant_id', value: 'merchant' },
      { type: 'hidden', name: 'm_payment_id', value: 'KXO-9062' },
      { type: 'hidden', name: 'signature', value: 'signature' },
    ]);
    expect(submit).toHaveBeenCalledOnce();
  });

  it('rejects malformed PayFast fields rather than submitting an invalid form', () => {
    expect(() => submitPayFastForm('https://sandbox.payfast.co.za/eng/process', {
      merchant_id: 123,
    })).toThrow('PayFast returned invalid checkout fields.');
    expect(document.body.querySelector('form')).toBeNull();
  });

  it('removes the form and surfaces a synchronous submission failure', () => {
    const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {
      throw new Error('Submission failed.');
    });

    expect(() => submitPayFastForm('https://sandbox.payfast.co.za/eng/process', {
      merchant_id: 'merchant',
    })).toThrow('Submission failed.');
    expect(document.body.querySelector('form')).toBeNull();
    expect(submit).toHaveBeenCalledOnce();
  });
});
