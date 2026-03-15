import { contextBridge, ipcRenderer } from 'electron';
import type { StartupProfile } from '../main/profile';
import type { EuropeanSummaryCard } from '../main/copilot';
import type { GrantSearchResult } from '../main/grantSearch';

/**
 * Exposes a secure, context-isolated API surface to the renderer process
 * via the contextBridge. All communication with the main process goes through
 * type-safe IPC invoke calls.
 */
contextBridge.exposeInMainWorld('euStartupNexus', {
  /**
   * Fetches or creates a startup profile (with caching logic in the main process).
   */
  getProfile: (businessName: string, profileUrl?: string): Promise<StartupProfile> =>
    ipcRenderer.invoke('profile:get', businessName, profileUrl),

  /**
   * Sends raw profile data to Copilot CLI and returns a European Summary Card.
   */
  generateSummaryCard: (rawProfile: Record<string, unknown>): Promise<EuropeanSummaryCard | null> =>
    ipcRenderer.invoke('copilot:generateSummaryCard', rawProfile),

  /**
   * Searches the EU Funding & Tenders Portal using the European Summary Card.
   */
  searchGrants: (summaryCard: EuropeanSummaryCard): Promise<GrantSearchResult> =>
    ipcRenderer.invoke('grants:search', summaryCard),

  euLogin: {
    /**
     * Saves EU Login credentials using OS-native encrypted storage.
     */
    save: (email: string, password: string): Promise<void> =>
      ipcRenderer.invoke('euLogin:save', email, password),

    /**
     * Retrieves stored EU Login credentials.
     */
    get: (): Promise<{ email: string; password: string } | null> =>
      ipcRenderer.invoke('euLogin:get'),

    /**
     * Checks whether EU Login credentials are stored.
     */
    has: (): Promise<boolean> =>
      ipcRenderer.invoke('euLogin:has'),

    /**
     * Clears stored EU Login credentials.
     */
    clear: (): Promise<void> =>
      ipcRenderer.invoke('euLogin:clear'),
  },
});
