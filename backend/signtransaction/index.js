import { generateRandomShellRunner } from './generateShellRunner';
import { generateSig, generateUpgradeSig } from './signTransaction';

const pinataJwt = process.env.PINATA_JWT;

async function pinataPinFile(imgdata) {
  if (!pinataJwt) {
    throw new Error('Missing env: PINATA_JWT');
  }
  const file = new Blob([imgdata], { type: 'image/png' });
  const form = new FormData();
  form.append('file', file, 'shellrunner.png');

  const resp = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { Authorization: `Bearer ${pinataJwt}` },
    body: form,
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Pinata pinFileToIPFS failed (${resp.status}): ${text}`);
  }
  const json = await resp.json();
  return json?.IpfsHash ? String(json.IpfsHash) : null;
}

async function pinataPinJson(obj) {
  if (!pinataJwt) {
    throw new Error('Missing env: PINATA_JWT');
  }
  const resp = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pinataJwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(obj),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Pinata pinJSONToIPFS failed (${resp.status}): ${text}`);
  }
  const json = await resp.json();
  return json?.IpfsHash ? String(json.IpfsHash) : null;
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      if (!pinataJwt) {
        res.status(500).json({ error: 'Missing env: PINATA_JWT' });
        return;
      }

      const { componentIndicesArray, imgdata, breed } =
        await generateRandomShellRunner();

      // Next.js may provide `req.body` as an object when `Content-Type: application/json`
      // is set. Support both raw string and parsed object.
      const parsedBody =
        typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
      const { score, walletAddress, action, tokenId } = parsedBody;
      if (score === undefined || !walletAddress) {
        res.status(400).json({ error: 'Missing score or walletAddress' });
        return;
      }
      const mode = action === 'upgrade' ? 'upgrade' : 'mint';
      if (mode === 'upgrade' && (tokenId === undefined || tokenId === null)) {
        res.status(400).json({ error: 'Missing tokenId for upgrade' });
        return;
      }

      const characterName = 'Breed ' + breed + ' Shell Runner';
      const speed = Number(score) + Math.floor(Math.random() * 51);

      const metadataPayload = {
        name: characterName,
        description: 'A Shell Runner that is on a journey in the river',
        componentIndices: {
          eyes: componentIndicesArray[0],
          hands: componentIndicesArray[1],
          head: componentIndicesArray[2],
          legs: componentIndicesArray[3],
          shell: componentIndicesArray[4],
          shellOuter: componentIndicesArray[5],
          tail: componentIndicesArray[6],
        },
        attributes: [
          { trait_type: 'speed', value: speed },
          { trait_type: 'breed', value: breed },
        ],
      };

      // MoltStation: Pinata only. Keep tokenURI small and stable.
      const imageCid = await pinataPinFile(imgdata);
      const metadataCid = await pinataPinJson({
        ...metadataPayload,
        image: imageCid ? `ipfs://${imageCid}` : undefined,
      });
      if (!metadataCid) {
        throw new Error('Pinata metadata pin failed');
      }
      const tokenURI = `ipfs://${metadataCid}`;

      const signature =
        mode === 'upgrade'
          ? await generateUpgradeSig(
              score.toString(),
              walletAddress,
              tokenURI,
              tokenId
            )
          : await generateSig(score.toString(), walletAddress, tokenURI);

      res.status(200).json({
        action: mode,
        tokenURI,
        metadataCid,
        signature,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: (e && e.message) ? e.message : 'Mint metadata generation failed' });
    }
  } else {
    res.status(404);
  }
}
