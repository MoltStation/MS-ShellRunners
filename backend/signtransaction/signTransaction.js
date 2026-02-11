import { encodePacked, keccak256 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// Must match `ShellRunners.signedWalletAddress()` on-chain.
// Prefer explicit env var names to avoid accidentally signing with the wrong key.
const privateKey =
  process.env.SHELLRUNNERS_SIGNER_PRIVATE_KEY ??
  process.env.NEXT_SHELLRUNNERS_SIGNER_PRIVATE_KEY ??
  process.env.NEXT_SHELLRUNNERS_PRIVATE_KEY ??
  process.env.METAMASK_PRIVATE_KEY;

export async function generateSig(score, walletAddress, tokenURI) {
  if (!privateKey) {
    throw new Error(
      'Missing ShellRunners signer private key (set SHELLRUNNERS_SIGNER_PRIVATE_KEY)'
    );
  }

  const messageHash = keccak256(
    encodePacked(
      ['uint256', 'address', 'string'],
      [BigInt(score), walletAddress, tokenURI]
    )
  );
  const account = privateKeyToAccount(privateKey);
  const signature = await account.signMessage({ message: { raw: messageHash } });

  const r = signature.slice(0, 66);
  const s = `0x${signature.slice(66, 130)}`;
  let v = parseInt(signature.slice(130, 132), 16);
  if (v < 27) v += 27;

  return {
    messageHash,
    r,
    s,
    v,
    signature,
  };
}

export async function generateUpgradeSig(score, walletAddress, tokenURI, tokenId) {
  if (!privateKey) {
    throw new Error(
      'Missing ShellRunners signer private key (set SHELLRUNNERS_SIGNER_PRIVATE_KEY)'
    );
  }

  const messageHash = keccak256(
    encodePacked(
      ['uint256', 'address', 'string', 'uint256'],
      [BigInt(score), walletAddress, tokenURI, BigInt(tokenId)]
    )
  );
  const account = privateKeyToAccount(privateKey);
  const signature = await account.signMessage({ message: { raw: messageHash } });

  const r = signature.slice(0, 66);
  const s = `0x${signature.slice(66, 130)}`;
  let v = parseInt(signature.slice(130, 132), 16);
  if (v < 27) v += 27;

  return {
    messageHash,
    r,
    s,
    v,
    signature,
  };
}
