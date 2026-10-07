import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminRoute } from '../../src/routes/AdminRoute';

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../../src/hooks/useAuth';

describe('AdminRoute', () => {
  let mockSignIn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSignIn = vi.fn();

    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      user: null,
      role: 'anon',
      isAdmin: false,
      isLoading: false,
      signIn: mockSignIn,
    });

    mockSignIn.mockReset();
  });

  it('shows the admin authentication form for anonymous users', () => {
    render(
      <AdminRoute>
        <div>Protected admin page</div>
      </AdminRoute>
    );

    expect(screen.getByText('Vault Admin Authentication')).toBeInTheDocument();
    expect(screen.getByLabelText('Staff Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Security Passcode')).toBeInTheDocument();
  });

  it('submits the staff credentials through the auth hook', async () => {
    const user = userEvent.setup();
    mockSignIn.mockResolvedValue({ success: true });

    render(
      <AdminRoute>
        <div>Protected admin page</div>
      </AdminRoute>
    );

    await user.type(screen.getByLabelText('Staff Email'), 'admin@kixora.com');
    await user.type(screen.getByLabelText('Security Passcode'), 'secret');
    await user.click(screen.getByRole('button', { name: /Authenticate to Admin Console/i }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({ email: 'admin@kixora.com', password: 'secret' });
    });
  });
});
