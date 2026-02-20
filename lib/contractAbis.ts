export const shellRunnersAbi = [
  {
    type: 'function',
    name: 'totalSupply',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'tokenURI',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getUserOwnedNFTs',
    stateMutability: 'view',
    inputs: [{ name: '_user', type: 'address' }],
    outputs: [
      {
        type: 'tuple[]',
        components: [
          { name: 'tokenId', type: 'uint256' },
          { name: 'tokenURI', type: 'string' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'userAddressToHighScore',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'userAddressToTokenId',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'generateShellRunner',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_score', type: 'uint256' },
      { name: '_tokenURI', type: 'string' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'upgradeShellRunner',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_score', type: 'uint256' },
      { name: '_tokenURI', type: 'string' },
      { name: '_tokenId', type: 'uint256' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'isApprovedForAll',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'operator', type: 'address' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'setApprovalForAll',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    outputs: [],
  },
] as const;

export const moltBotArenaMarketAbi = [
  {
    type: 'function',
    name: 'getListingPrice',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'createMarketItem',
    stateMutability: 'payable',
    inputs: [
      { name: 'nftContract', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
      { name: 'price', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'createMarketSale',
    stateMutability: 'payable',
    inputs: [
      { name: 'nftContract', type: 'address' },
      { name: 'itemId', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'fetchMarketItems',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        type: 'tuple[]',
        components: [
          { name: 'itemId', type: 'uint256' },
          { name: 'nftContract', type: 'address' },
          { name: 'tokenId', type: 'uint256' },
          { name: 'seller', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'price', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
          { name: 'sold', type: 'bool' },
          { name: 'canceled', type: 'bool' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'listingNonces',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'cancelMarketItem',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'itemId', type: 'uint256' }],
    outputs: [],
  },
] as const;

export const rewardsAbi = [
  {
    type: 'function',
    name: 'payoutCooldown',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'lastPayoutAt',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'firstPlayAt',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'scoreToTokenRate',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getScorebank',
    stateMutability: 'view',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'score', type: 'uint256' },
          { name: 'lastSnapshotAt', type: 'uint256' },
          { name: 'sessionId', type: 'bytes32' },
          { name: 'sessionExpiresAt', type: 'uint256' },
          { name: 'identityId', type: 'uint256' },
        ],
      },
    ],
  },
] as const;

export const erc721MetadataAbi = [
  {
    type: 'function',
    name: 'tokenURI',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'string' }],
  },
] as const;

export const erc721ApprovalAbi = [
  {
    type: 'function',
    name: 'isApprovedForAll',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'operator', type: 'address' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'setApprovalForAll',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    outputs: [],
  },
] as const;

export const poptAbi = [
  {
    type: 'function',
    name: 'getPoPTId',
    stateMutability: 'view',
    inputs: [{ name: 'agentIdentityId', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getPoPTId',
    stateMutability: 'view',
    inputs: [
      { name: 'gameId', type: 'bytes32' },
      { name: 'agentIdentityId', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const;

export const identityAbi = [
  {
    type: 'function',
    name: 'primaryIdentity',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'mintNonces',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'mintIdentityWithSignature',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'tokenUri', type: 'string' },
      { name: 'deadline', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const;
