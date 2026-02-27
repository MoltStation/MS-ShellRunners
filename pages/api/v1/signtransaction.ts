import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(410).json({
    error: 'Deprecated endpoint removed. Use /api/games/shellrunners/nft/prepare.',
    code: 'LEGACY_ENDPOINT_REMOVED',
  });
}
