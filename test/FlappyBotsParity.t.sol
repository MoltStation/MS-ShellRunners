// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../src/ShellRunners.sol";
import "../src/FlappyBots.sol";

contract MockAgentIdentity {
  mapping(address => uint256) public primaryIdentity;

  function setPrimaryIdentity(address owner, uint256 tokenId) external {
    primaryIdentity[owner] = tokenId;
  }
}

contract FlappyBotsParityTest {
  MockAgentIdentity private identity;
  ShellRunners private shellRunners;
  FlappyBots private flappyBots;

  address private constant SIGNER = address(0xBEEF);

  constructor() {
    identity = new MockAgentIdentity();
    shellRunners = new ShellRunners(address(identity), SIGNER);
    flappyBots = new FlappyBots(address(identity), SIGNER);
  }

  function testInitialContractParity() public view {
    require(shellRunners.totalSupply() == flappyBots.totalSupply(), "supply mismatch");
    require(
      shellRunners.signerRotationDelay() == flappyBots.signerRotationDelay(),
      "rotation delay mismatch"
    );
    require(shellRunners.signedWalletAddress() == flappyBots.signedWalletAddress(), "signer mismatch");
    require(
      shellRunners.getUserNonce(address(this)) == flappyBots.getUserNonce(address(this)),
      "nonce mismatch"
    );
  }

  function testIdentityContractParity() public view {
    require(
      address(shellRunners.identityContract()) == address(flappyBots.identityContract()),
      "identity mismatch"
    );
  }
}
