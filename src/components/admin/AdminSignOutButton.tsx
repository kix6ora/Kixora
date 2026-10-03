import React from 'react';
import { LogOut } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../hooks/useAuth';

export const AdminSignOutButton: React.FC = () => {
  const { signOut } = useAuth();
  const { setCurrentView } = useStore();

  const handleSignOut = async () => {
    await signOut();
    setCurrentView('admin');
  };

  return (
    <button
      type="button"
      onClick={() => { void handleSignOut(); }}
      className="w-full flex items-center justify-center gap-2 rounded-lg border border-[#333333] px-3 py-2 text-xs font-semibold text-[#CCCCCC] hover:border-[#FF7A00] hover:text-[#FF7A00] transition-colors"
    >
      <LogOut className="h-4 w-4" />
      <span>Sign out</span>
    </button>
  );
};
