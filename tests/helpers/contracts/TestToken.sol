// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TestToken
 * @dev Simple ERC20 Token for testing purposes
 */
contract TestToken is ERC20, Ownable {
    uint8 private _decimals;
    
    // Custom event for token transfers with additional metadata
    event TokenTransferred(
        address indexed from,
        address indexed to,
        uint256 value,
        string name,
        string symbol,
        uint8 decimals
    );

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply_,
        uint8 decimals_,
        address mintTo_
    ) ERC20(name_, symbol_) Ownable(mintTo_) {
        _decimals = decimals_;
        _mint(mintTo_, initialSupply_);
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @dev Mint new tokens to the specified address
     * @param to The address to mint tokens to
     * @param amount The amount of tokens to mint
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev Burn tokens from the specified address
     * @param from The address to burn tokens from
     * @param amount The amount of tokens to burn
     */
    function burn(address from, uint256 amount) public {
        _burn(from, amount);
    }
    
    /**
     * Override _update to emit our custom TokenTransferred event
     * This will be called for all transfers (including mints and burns)
     */
    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        
        // Only emit for actual transfers (not mints or burns)
        if (from != address(0) && to != address(0)) {
            emit TokenTransferred(from, to, value, name(), symbol(), decimals());
        }
    }
}