import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PrivacySettings } from '../../src/components/PrivacySettings';

describe('PrivacySettings', () => {
  it('exposes an accessible analytics toggle and updates state when clicked', () => {
    render(<PrivacySettings isOpen={true} onClose={vi.fn()} />);

    const toggle = screen.getByRole('switch', { name: /business analytics/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/tracking is currently disabled/i)).toBeInTheDocument();
  });
});
