import type { IpcMain } from 'electron';
import { getStartupProfile } from './profile';
import { generateEuropeanSummaryCard } from './copilot';
import { searchGrants } from './grantSearch';
import { saveEuLoginCredentials, getEuLoginCredentials, clearEuLoginCredentials, hasEuLoginCredentials } from './euLogin';
import type { StartupProfile } from './profile';
import type { EuropeanSummaryCard } from './copilot';
import type { GrantSearchResult } from './grantSearch';

/**
 * Registers all IPC handlers for communication between the renderer
 * process and the main process.
 */
export function registerIpcHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    'profile:get',
    async (_event, businessName: string, profileUrl?: string): Promise<StartupProfile> => {
      return getStartupProfile(businessName, profileUrl);
    }
  );

  ipcMain.handle(
    'copilot:generateSummaryCard',
    async (_event, rawProfile: Record<string, unknown>): Promise<EuropeanSummaryCard | null> => {
      return generateEuropeanSummaryCard(rawProfile);
    }
  );

  ipcMain.handle(
    'grants:search',
    async (_event, summaryCard: EuropeanSummaryCard): Promise<GrantSearchResult> => {
      return searchGrants(summaryCard);
    }
  );

  ipcMain.handle(
    'euLogin:save',
    (_event, email: string, password: string): void => {
      saveEuLoginCredentials(email, password);
    }
  );

  ipcMain.handle(
    'euLogin:get',
    (): { email: string; password: string } | null => {
      return getEuLoginCredentials();
    }
  );

  ipcMain.handle(
    'euLogin:has',
    (): boolean => {
      return hasEuLoginCredentials();
    }
  );

  ipcMain.handle(
    'euLogin:clear',
    (): void => {
      clearEuLoginCredentials();
    }
  );
}
