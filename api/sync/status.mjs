import { handleSyncStatusRequest } from '../../apps/desktop/server/tursoSync.mjs';

export default async function handler(req, res) {
  await handleSyncStatusRequest(req, res);
}
