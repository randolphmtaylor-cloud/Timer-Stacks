import { invoke } from '@tauri-apps/api/core';

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function updateDesktopTrayTimer(label: string | null): Promise<void> {
  if (!isTauriRuntime()) return;

  try {
    await invoke('update_tray_timer', { label });
  } catch (error) {
    console.error('[desktop-tray] Failed to update tray timer', error);
  }
}
