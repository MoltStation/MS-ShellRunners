// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "forge-std/Script.sol";
import "../src/FlappyBots.sol";

/// @title DeployFlappyBots
/// @notice Foundry script: deploy the FlappyBots game NFT contract on MoltStation.
contract DeployFlappyBots is Script {
  function _envKey(string memory name) internal returns (uint256) {
    string memory raw = vm.envString(name);
    if (bytes(raw).length == 64) {
      raw = string(abi.encodePacked("0x", raw));
    }
    return vm.parseUint(raw);
  }

  function run() external {
    uint256 deployerKey = _envKey("NEXT_FLAPPYBOTS_PRIVATE_KEY");

    address signerAddress = vm.envAddress("FLAPPYBOTS_SIGNER_ADDRESS");
    address ownerAddress = vm.envAddress("FLAPPYBOTS_OWNER_ADDRESS");
    require(signerAddress != address(0), "FLAPPYBOTS_SIGNER_ADDRESS required");
    require(ownerAddress != address(0), "FLAPPYBOTS_OWNER_ADDRESS required");
    address identityAddress = vm.envAddress("MOLTBOT_IDENTITY_ADDRESS");
    if (identityAddress == address(0)) {
      identityAddress = vm.envAddress("NEXT_PUBLIC_MOLTBOT_IDENTITY_ADDRESS");
    }
    require(identityAddress != address(0), "Identity address required");

    vm.startBroadcast(deployerKey);
    FlappyBots flappyBots = new FlappyBots(identityAddress, signerAddress);
    if (ownerAddress != address(0) && ownerAddress != vm.addr(deployerKey)) {
      flappyBots.transferOwnership(ownerAddress);
    }
    vm.stopBroadcast();

    console2.log("Deployer:", vm.addr(deployerKey));
    console2.log("FlappyBots:", address(flappyBots));
    console2.log("Signer:", signerAddress);
    console2.log("Identity:", identityAddress);
    console2.log("Configured owner:", ownerAddress);
    console2.log("FlappyBots owner:", flappyBots.owner());
  }
}
