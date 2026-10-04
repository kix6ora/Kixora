/**
 * Kixora Privacy Settings Component
 * Allows users to manage analytics and tracking preferences.
 */
import React, { useState } from 'react';
import { analyticsService } from '../services/analyticsService';
import { X, Shield, Info } from 'lucide-react';
import { motion } from 'motion/react';

interface PrivacySettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacySettings: React.FC<PrivacySettingsProps> = ({ isOpen, onClose }) => {
  const [isOptedOut, setIsOptedOut] = useState(() => analyticsService.isOptedOut());

  const handleToggle = () => {
    const nextState = !isOptedOut;
    analyticsService.setOptOut(nextState);
    setIsOptedOut(nextState);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-[#141414] border border-[#282828] rounded-2xl p-6 shadow-2xl text-[#F5F5F5]"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#FF7A00]" />
            <h3 className="font-display font-bold text-lg">Privacy Controls</h3>
          </div>
          <button
            type="button"
            aria-label="Close privacy settings"
            onClick={onClose}
            className="p-1 text-[#888888] hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-[#1A1A1A] border border-[#282828] space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-bold">Business Analytics</p>
                <p className="text-[11px] text-[#888888] leading-relaxed">
                  We collect anonymous data about how you interact with our vault to improve the shopping experience. 
                  No PII or payment data is ever shared.
                </p>
              </div>
              <button
                id="privacy-analytics-toggle"
                type="button"
                role="switch"
                aria-label="Business analytics"
                aria-checked={!isOptedOut}
                aria-pressed={!isOptedOut}
                onClick={handleToggle}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  !isOptedOut ? 'bg-[#FF7A00]' : 'bg-[#333333]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    !isOptedOut ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            
            <div
              aria-live="polite"
              className="flex items-center gap-2 pt-2 border-t border-[#282828] text-[10px] text-[#FF7A00]"
            >
              <Info className="w-3 h-3" />
              <span>{isOptedOut ? 'Tracking is currently DISABLED' : 'Tracking is currently ENABLED'}</span>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[11px] text-[#666666] italic">
              Kixora strictly adheres to POPIA and GDPR principles. We only collect meaningful business events 
              and never store unnecessary personal information.
            </p>
            <button
              type="button"
              aria-label="Close privacy preferences"
              onClick={onClose}
              className="w-full py-3 bg-[#1F1F1F] hover:bg-[#262626] border border-[#333333] rounded-xl text-xs font-bold transition-colors"
            >
              Close Preferences
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
