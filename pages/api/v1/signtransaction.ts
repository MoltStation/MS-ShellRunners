import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(404).end();
    return;
  }

  const base = (
    process.env.MOLTBOT_API_URL ??
    process.env.NEXT_PUBLIC_MOLTBOT_API_URL
  )?.replace(/\/$/, '');
  if (!base) {
    res
      .status(500)
      .json({ error: 'Missing env: MOLTBOT_API_URL or NEXT_PUBLIC_MOLTBOT_API_URL' });
    return;
  }

  try {
    const upstream = await fetch(`${base}/api/shellrunners/signtransaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body ?? {}),
    });
    const text = await upstream.text();
    res.status(upstream.status).send(text);
  } catch (error: any) {
    res.status(500).json({
      error: error?.message ?? 'Proxy request failed',
    });
  }
}
