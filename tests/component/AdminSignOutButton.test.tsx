import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminSignOutButton } from '../../src/components/admin/AdminSignOutButton';

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  setCurrentView: vi.fn(),
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ signOut: mocks.signOut }),
}));

vi.mock('../../src/context/StoreContext', () => ({
  useStore: () => ({ setCurrentView: mocks.setCurrentView }),
}));

describe('AdminSignOutButton', () => {
  beforeEach(() => {
    mocks.signOut.mockReset().mockResolvedValue(undefined);
    mocks.setCurrentView.mockReset();
  });

  it('signs out through auth and returns to the guarded admin login view', async () => {
    render(<AdminSignOutButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => {
      expect(mocks.signOut).toHaveBeenCalledOnce();
      expect(mocks.setCurrentView).toHaveBeenCalledWith('admin');
    });
  });
});
