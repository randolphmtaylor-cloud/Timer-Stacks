import { handleStacksRequest } from '../../server/tursoSync.mjs';

export default async function handler(req, res) {
  await handleStacksRequest(req, res);
}
