import dbConnect from './mongodb';
import shellRunner from './models/shellrunners';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    await dbConnect();
  } catch (e) {
    console.error(e);
    return res.status(500).send('database connection error');
  }

  if (req.method === 'GET') {
    try {
      const username = req.query.username as string | undefined;
      if (!username) {
        return res.status(400).json({
          message: 'username query param required',
          success: false,
        });
      }
      const record = await shellRunner.findOne({ username });
      return res.json({
        message: JSON.parse(JSON.stringify(record)),
        success: true,
      });
    } catch (error: any) {
      return res.json({
        message: new Error(error).message,
        success: false,
      });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { username, shellRunners } = body ?? {};
      if (!username) {
        return res.status(400).json({
          message: 'username is required',
          success: false,
        });
      }
      const record = await shellRunner.findOneAndUpdate(
        { username },
        { shellRunners, updatedAt: new Date() },
        { new: true, upsert: true }
      );
      return res.json({
        message: JSON.parse(JSON.stringify(record)),
        success: true,
      });
    } catch (error: any) {
      return res.json({
        message: new Error(error).message,
        success: false,
      });
    }
  }

  return res.status(200).json({ error: 'Wrong route fetching' });
}
