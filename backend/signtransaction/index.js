export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(404).end();
    return;
  }
  res.status(410).json({
    error:
      'Deprecated local signing endpoint removed. Use MoltStation-Backend /api/games/shellrunners/nft/prepare.',
  });
}
