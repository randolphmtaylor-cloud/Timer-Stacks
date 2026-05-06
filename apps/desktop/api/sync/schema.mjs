import { handleSchemaRequest } from '../../server/tursoSchema.mjs';

export default async function handler(req, res) {
  await handleSchemaRequest(req, res);
}
