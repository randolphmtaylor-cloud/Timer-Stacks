import { handleSettingsRequest } from '../../server/tursoSync.mjs';

export default async function handler(req, res) {
  await handleSettingsRequest(req, res);
}
