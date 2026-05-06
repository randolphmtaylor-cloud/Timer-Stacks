import { handleStacksRequest } from '../../apps/desktop/server/tursoSync.mjs';

export default async function handler(req, res) {
  await handleStacksRequest(req, res);
}
