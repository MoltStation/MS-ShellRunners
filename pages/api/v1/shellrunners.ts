import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(410).json({
    error:
      'Deprecated local API route. Move shellrunner user records to MoltStation-Backend.',
  });
}
