// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PlatformToken - Governance token for the platform
 * @notice Used for pool creation fees and voting
 */
contract PlatformToken is ERC20, Ownable {
    constructor() ERC20("Dog House Token", "HOUSE") Ownable(msg.sender) {
        // Mint initial supply to deployer
        _mint(msg.sender, 1_000_000 * 1e18); // 1M tokens
    }

    /**
     * @notice Mint tokens (only owner)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @notice Burn tokens
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}