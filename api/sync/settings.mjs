import { handleSettingsRequest } from '../../apps/desktop/server/tursoSync.mjs';

export default async function handler(req, res) {
  await handleSettingsRequest(req, res);
}
