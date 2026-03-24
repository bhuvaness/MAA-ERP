import { useState, useCallback } from 'react';
import type { SetupData } from '../types';

export function useSetupFlow() {
  const [setupComplete, setSetupComplete] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [setupData, setSetupData] = useState<SetupData>({});
  const [showChat, setShowChat] = useState(false);

  const updateSetupData = useCallback((key: string, value: string) => {
    setSetupData(prev => ({ ...prev, [key]: value }));
  }, []);

  const completeSetup = useCallback(() => {
    setSetupComplete(true);
    setCurrentStep(6);
  }, []);

  const beginSetup = useCallback(() => {
    setShowChat(true);
    setCurrentStep(0);
  }, []);

  /**
   * Restore setup state from a saved business config.
   * Called on app mount when data/business-config.json exists.
   */
  const restoreSetup = useCallback((data: SetupData) => {
    setSetupData(data);
    setSetupComplete(true);
    setCurrentStep(6);
    setShowChat(true);
  }, []);

  return { setupComplete, currentStep, setupData, showChat, setShowChat, setCurrentStep, updateSetupData, completeSetup, beginSetup, restoreSetup };
}
