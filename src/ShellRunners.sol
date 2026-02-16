// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IAgentIdentity {
  function primaryIdentity(address owner) external view returns (uint256);
}

/// @title ShellRunners
/// @notice MoltStation game NFT contract for Shell Runners (shrimp racers).
/// @dev This contract is a fork-derived base that has been extended for MoltStation:
///      - Identity ownership gating (requires an AgentIdentity token to mint/upgrade)
///      - Signed mint/upgrade payloads validated by `signedWalletAddress`
///      Marketplace concerns are handled by the core MoltStation marketplace contract.
/// @author MoltStation contributors
/// @custom:website https://moltstation.games
contract ShellRunners is ERC721URIStorage, ReentrancyGuard {
  using ECDSA for bytes32;
  using Counters for Counters.Counter;
  Counters.Counter private _totalSupply;

  address payable public immutable contractOwner; // Owner of this contract
  IAgentIdentity public identityContract;

  address[] private users; // Address array to store all the users

  address public signedWalletAddress;

  // Mapping from User address to high score
  mapping(address => uint256) public userAddressToHighScore;
  // Mapping from user to their one allowed ShellRunner token id (0 = none).
  mapping(address => uint256) public userAddressToTokenId;

  // Events

  // Emitted when a new Shell Runner is generated after reaching a new checkpoint in the game
  event NewShellRunnerGenerated(uint256 tokenId);

  // Emitted when an existing Shell Runner is upgraded by its owner
  event ShellRunnerUpgraded(uint256 tokenId);

  // Emitted when a Shell Runner is bought
  event ShellRunnerBought(uint256 tokenId);

  // Emitted when a Shell Runner is put up for sale
  event ShellRunnerUpForSale(uint256 tokenId);

  struct NFTItem {
    uint256 tokenId;
    string tokenURI;
  }

  // Constructor is called when the ShellRunners contract is deployed.
  constructor(address identityAddress, address signerAddress)
    ERC721("MoltStation ShellRunners", "MSSH")
  {
    require(identityAddress != address(0), "Invalid identity address");
    require(signerAddress != address(0), "Invalid signer address");
    contractOwner = payable(msg.sender);
    identityContract = IAgentIdentity(identityAddress);
    signedWalletAddress = signerAddress;
  }

  // Modifer that checks to see if msg.sender == contractOwner
  modifier onlyContractOwner() {
    require(
      msg.sender == contractOwner,
      "The caller is not the contract owner"
    );
    _;
  }

  // Function 'totalSupply' returns the total token supply of this contract
  function totalSupply() public view returns (uint256) {
    return _totalSupply.current();
  }

  function setIdentityContractAddress(address _contractAddress)
    public
    onlyContractOwner
  {
    require(_contractAddress != address(0), "Invalid identity address");
    identityContract = IAgentIdentity(_contractAddress);
  }

  // Function 'getUsers' returns the address array of users
  function getUsers() public view returns (address[] memory) {
    return users;
  }

  // Function 'setHighScore' sets a new highScore for the user
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

  // Function 'generateShellRunner' mints a new Shell Runner NFT for the user
  function generateShellRunner(
    uint256 _score,
    string memory _tokenURI,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) public nonReentrant onlyIdentityHolder {
    bytes32 message = keccak256(
      abi.encodePacked(_score, msg.sender, _tokenURI)
    );

    bytes32 messageHash = message.toEthSignedMessageHash();
    address walletAddress = messageHash.recover(v, r, s);
    require(walletAddress == signedWalletAddress, "Invalid signature");
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

  // Function 'upgradeShellRunner' upgrades an existing Shell Runner NFT
  function upgradeShellRunner(
    uint256 _score,
    string memory _tokenURI,
    uint256 _tokenId,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) public nonReentrant onlyIdentityHolder {
    bytes32 message = keccak256(
      abi.encodePacked(_score, msg.sender, _tokenURI, _tokenId)
    );

    bytes32 messageHash = message.toEthSignedMessageHash();
    address walletAddress = messageHash.recover(v, r, s);
    require(walletAddress == signedWalletAddress, "Invalid signature");
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

  // Function 'setSignedWalletAddress' sets the address of the wallet that signs the minting of the Shell Runner NFT
  function setSignedWalletAddress(address _walletAddress)
    public
    onlyContractOwner
  {
    signedWalletAddress = _walletAddress;
  }

  // Function 'updateTokenURI' updates the Token URI for a specific Token
  function updateTokenURI(uint256 _tokenId, string memory _tokenURI)
    public
    onlyContractOwner
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
