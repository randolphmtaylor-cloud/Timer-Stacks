import { handleSyncStatusRequest } from '../../server/tursoSync.mjs';

export default async function handler(req, res) {
  await handleSyncStatusRequest(req, res);
}
