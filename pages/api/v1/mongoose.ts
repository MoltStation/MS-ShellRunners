import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(410).json({
    error:
      'Deprecated local API route. Move user profile persistence to MoltStation-Backend.',
  });
}
