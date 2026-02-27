// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IAgentIdentity {
  function primaryIdentity(address owner) external view returns (uint256);
}

/// @title ShellRunners
/// @notice MoltStation game NFT contract for Shell Runners (shrimp racers).
/// @dev This contract is a fork-derived base that has been extended for MoltStation:
///      - Identity ownership gating (requires an AgentIdentity token to mint/upgrade)
///      - EIP-712 signed mint/upgrade payloads with nonce + deadline
///      - Delayed signer rotation for operational safety
///      Marketplace concerns are handled by the core MoltStation marketplace contract.
/// @author MoltStation contributors
/// @custom:website https://moltstation.games
contract ShellRunners is ERC721URIStorage, ReentrancyGuard, EIP712, Ownable {
  using Counters for Counters.Counter;

  bytes32 private constant MINT_TYPEHASH = keccak256(
    "MintShellRunner(uint256 chainId,address verifyingContract,address wallet,uint256 score,bytes32 tokenURIHash,uint256 nonce,uint256 deadline)"
  );
  bytes32 private constant UPGRADE_TYPEHASH = keccak256(
    "UpgradeShellRunner(uint256 chainId,address verifyingContract,address wallet,uint256 score,bytes32 tokenURIHash,uint256 tokenId,uint256 nonce,uint256 deadline)"
  );

  uint256 public constant MIN_SIGNER_ROTATION_DELAY = 1 hours;
  uint256 public constant MAX_SIGNER_ROTATION_DELAY = 30 days;
  uint256 public constant DEFAULT_SIGNER_ROTATION_DELAY = 1 days;

  Counters.Counter private _totalSupply;

  IAgentIdentity public identityContract;
  address[] private users;

  address public signedWalletAddress;
  address public pendingSignedWalletAddress;
  uint256 public signerRotationEta;
  uint256 public signerRotationDelay;

  mapping(address => uint256) public userAddressToHighScore;
  mapping(address => uint256) public userAddressToTokenId;
  mapping(address => uint256) public userNonces;

  event NewShellRunnerGenerated(uint256 tokenId);
  event ShellRunnerUpgraded(uint256 tokenId);
  event ShellRunnerBought(uint256 tokenId);
  event ShellRunnerUpForSale(uint256 tokenId);

  event SignerRotationScheduled(address indexed previousSigner, address indexed nextSigner, uint256 eta);
  event SignerRotationApplied(address indexed previousSigner, address indexed nextSigner);
  event SignerRotationCancelled(address indexed pendingSigner);
  event SignerRotationDelayUpdated(uint256 previousDelay, uint256 newDelay);

  struct NFTItem {
    uint256 tokenId;
    string tokenURI;
  }

  constructor(address identityAddress, address signerAddress)
    ERC721("MoltStation ShellRunners", "MSSH")
    EIP712("ShellRunners", "1")
  {
    require(identityAddress != address(0), "Invalid identity address");
    require(signerAddress != address(0), "Invalid signer address");
    identityContract = IAgentIdentity(identityAddress);
    signedWalletAddress = signerAddress;
    signerRotationDelay = DEFAULT_SIGNER_ROTATION_DELAY;
  }

  function totalSupply() public view returns (uint256) {
    return _totalSupply.current();
  }

  function setIdentityContractAddress(address _contractAddress)
    public
    onlyOwner
  {
    require(_contractAddress != address(0), "Invalid identity address");
    identityContract = IAgentIdentity(_contractAddress);
  }

  function getUsers() public view returns (address[] memory) {
    return users;
  }

  function getUserNonce(address wallet) public view returns (uint256) {
    return userNonces[wallet];
  }

  function setHighScore(uint256 _newHighScore, address _sender) internal {
    if (userAddressToHighScore[_sender] == 0) {
      users.push(_sender);
    }
    userAddressToHighScore[_sender] = _newHighScore;
  }

  modifier onlyIdentityHolder() {
    require(
      identityContract.primaryIdentity(msg.sender) != 0,
      "Identity required"
    );
    _;
  }

  function _consumeNonce(address wallet, uint256 nonce) private {
    require(userNonces[wallet] == nonce, "Invalid nonce");
    userNonces[wallet] = nonce + 1;
  }

  function _hashMintPayload(
    address wallet,
    uint256 score,
    string memory tokenUri,
    uint256 nonce,
    uint256 deadline
  ) private view returns (bytes32) {
    return _hashTypedDataV4(
      keccak256(
        abi.encode(
          MINT_TYPEHASH,
          block.chainid,
          address(this),
          wallet,
          score,
          keccak256(bytes(tokenUri)),
          nonce,
          deadline
        )
      )
    );
  }

  function _hashUpgradePayload(
    address wallet,
    uint256 score,
    string memory tokenUri,
    uint256 tokenId,
    uint256 nonce,
    uint256 deadline
  ) private view returns (bytes32) {
    return _hashTypedDataV4(
      keccak256(
        abi.encode(
          UPGRADE_TYPEHASH,
          block.chainid,
          address(this),
          wallet,
          score,
          keccak256(bytes(tokenUri)),
          tokenId,
          nonce,
          deadline
        )
      )
    );
  }

  function generateShellRunner(
    uint256 _score,
    string memory _tokenURI,
    uint256 _nonce,
    uint256 _deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) public nonReentrant onlyIdentityHolder {
    require(block.timestamp <= _deadline, "Signature expired");

    bytes32 digest = _hashMintPayload(msg.sender, _score, _tokenURI, _nonce, _deadline);
    address walletAddress = ECDSA.recover(digest, v, r, s);
    require(walletAddress == signedWalletAddress, "Invalid signature");

    _consumeNonce(msg.sender, _nonce);

    require(userAddressToTokenId[msg.sender] == 0, "ShellRunner already minted");
    require(
      _score > userAddressToHighScore[msg.sender],
      "Already minted at this score before"
    );

    setHighScore(_score, msg.sender);
    _totalSupply.increment();
    uint256 _tokenID = totalSupply();
    _safeMint(msg.sender, _tokenID);
    _setTokenURI(_tokenID, _tokenURI);
    userAddressToTokenId[msg.sender] = _tokenID;

    emit NewShellRunnerGenerated(_tokenID);
  }

  function upgradeShellRunner(
    uint256 _score,
    string memory _tokenURI,
    uint256 _tokenId,
    uint256 _nonce,
    uint256 _deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) public nonReentrant onlyIdentityHolder {
    require(block.timestamp <= _deadline, "Signature expired");

    bytes32 digest = _hashUpgradePayload(
      msg.sender,
      _score,
      _tokenURI,
      _tokenId,
      _nonce,
      _deadline
    );
    address walletAddress = ECDSA.recover(digest, v, r, s);
    require(walletAddress == signedWalletAddress, "Invalid signature");

    _consumeNonce(msg.sender, _nonce);

    require(userAddressToTokenId[msg.sender] != 0, "No ShellRunner minted yet");
    require(
      userAddressToTokenId[msg.sender] == _tokenId,
      "Upgrade token must match user primary token"
    );
    require(ownerOf(_tokenId) == msg.sender, "Not token owner");
    require(
      _score > userAddressToHighScore[msg.sender],
      "Already minted at this score before"
    );

    setHighScore(_score, msg.sender);
    _setTokenURI(_tokenId, _tokenURI);
    emit ShellRunnerUpgraded(_tokenId);
  }

  function setSignerRotationDelay(uint256 newDelaySeconds) public onlyOwner {
    require(newDelaySeconds >= MIN_SIGNER_ROTATION_DELAY, "Delay too short");
    require(newDelaySeconds <= MAX_SIGNER_ROTATION_DELAY, "Delay too long");

    uint256 previous = signerRotationDelay;
    signerRotationDelay = newDelaySeconds;
    emit SignerRotationDelayUpdated(previous, newDelaySeconds);
  }

  function scheduleSignerRotation(address nextSigner) public onlyOwner {
    require(nextSigner != address(0), "Invalid signer address");

    pendingSignedWalletAddress = nextSigner;
    signerRotationEta = block.timestamp + signerRotationDelay;

    emit SignerRotationScheduled(signedWalletAddress, nextSigner, signerRotationEta);
  }

  function applySignerRotation() public onlyOwner {
    address pending = pendingSignedWalletAddress;
    require(pending != address(0), "No signer rotation pending");
    require(block.timestamp >= signerRotationEta, "Signer rotation timelock active");

    address previous = signedWalletAddress;
    signedWalletAddress = pending;
    pendingSignedWalletAddress = address(0);
    signerRotationEta = 0;

    emit SignerRotationApplied(previous, signedWalletAddress);
  }

  function cancelSignerRotation() public onlyOwner {
    address pending = pendingSignedWalletAddress;
    require(pending != address(0), "No signer rotation pending");

    pendingSignedWalletAddress = address(0);
    signerRotationEta = 0;

    emit SignerRotationCancelled(pending);
  }

  // Backward-compatible alias; now schedules instead of immediate rotation.
  function setSignedWalletAddress(address _walletAddress)
    public
    onlyOwner
  {
    scheduleSignerRotation(_walletAddress);
  }

  function updateTokenURI(uint256 _tokenId, string memory _tokenURI)
    public
    onlyOwner
  {
    _setTokenURI(_tokenId, _tokenURI);
  }

  function getBalanceOfUser(address _user) public view returns (uint256) {
    return balanceOf(_user);
  }

  function getUserOwnedNFTs(address _user)
    public
    view
    returns (NFTItem[] memory)
  {
    NFTItem[] memory nfts = new NFTItem[](getBalanceOfUser(_user));
    uint256 totalNFTCount = totalSupply();
    uint256 curInd = 0;
    for (uint256 i = 1; i <= totalNFTCount; i++) {
      if (ownerOf(i) == _user) {
        nfts[curInd++] = NFTItem({ tokenId: i, tokenURI: tokenURI(i) });
      }
    }
    return nfts;
  }

  function getAllNFTs() public view returns (NFTItem[] memory) {
    uint256 totalNFTCount = totalSupply();
    NFTItem[] memory nfts = new NFTItem[](totalNFTCount);
    for (uint256 i = 1; i <= totalNFTCount; i++) {
      nfts[i - 1] = NFTItem({ tokenId: i, tokenURI: tokenURI(i) });
    }
    return nfts;
  }
}
