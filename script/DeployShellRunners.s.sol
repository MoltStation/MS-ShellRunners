// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "forge-std/Script.sol";
import "../src/ShellRunners.sol";

/// @title DeployShellRunners
/// @notice Foundry script: deploy the ShellRunners game contract on MoltStation.
/// @dev Uses env vars from `play-to-earn-NFT-game-EVM/.env`:
///      - `NEXT_SHELLRUNNERS_PRIVATE_KEY` (deployer key for the game contract)
///      - `MOLTBOT_IDENTITY_ADDRESS` or `NEXT_PUBLIC_MOLTBOT_IDENTITY_ADDRESS`
/// @author MoltStation contributors
/// @custom:website https://moltstation.games
contract DeployShellRunners is Script {
  function _envKey(string memory name) internal returns (uint256) {
    string memory raw = vm.envString(name);
    if (bytes(raw).length == 64) {
      raw = string(abi.encodePacked("0x", raw));
    }
    return vm.parseUint(raw);
  }

  function run() external {
    uint256 shellRunnersDeployerKey = _envKey("NEXT_SHELLRUNNERS_PRIVATE_KEY");

    // Use the ShellRunners deployer as the signer by default.
    address signerAddress = vm.addr(shellRunnersDeployerKey);
    address identityAddress = vm.envAddress("MOLTBOT_IDENTITY_ADDRESS");
    if (identityAddress == address(0)) {
      identityAddress = vm.envAddress("NEXT_PUBLIC_MOLTBOT_IDENTITY_ADDRESS");
    }
    require(identityAddress != address(0), "Identity address required");

    vm.startBroadcast(shellRunnersDeployerKey);
    ShellRunners shellRunners = new ShellRunners(identityAddress, signerAddress);
    vm.stopBroadcast();

    console2.log("Deployer:", vm.addr(shellRunnersDeployerKey));
    console2.log("ShellRunners:", address(shellRunners));
    console2.log("Signer:", signerAddress);
    console2.log("Identity:", identityAddress);
    console2.log("ShellRunners owner:", shellRunners.contractOwner());
  }
}
