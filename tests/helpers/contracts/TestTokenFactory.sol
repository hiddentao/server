// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./TestToken.sol";

/**
 * @title TestTokenFactory
 * @dev Factory contract for deploying TestToken contracts - mirrors ERC20Factory.sol
 */
contract TestTokenFactory {
    event ERC20NewToken(address indexed token, string name, string symbol, address indexed creator, uint256 initialSupply);
    
    mapping(uint256 => address) public erc20Addresses;
    uint256 public numERC20s;
    
    struct TokenConfig {
        string name;
        string symbol;
        uint8 decimals;
    }
    
    /**
     * Deploy a new ERC20 token via factory
     */
    function erc20DeployToken(
        TokenConfig memory config,
        uint256 initialBalance
    ) external returns (address) {
        require(bytes(config.name).length > 0, "Name cannot be empty");
        require(bytes(config.symbol).length > 0, "Symbol cannot be empty");
        require(config.decimals > 0, "Decimals must be greater than 0");
        
        // Deploy new TestToken (mints directly to caller)
        TestToken token = new TestToken(
            config.name,
            config.symbol,
            initialBalance,
            config.decimals,
            msg.sender
        );
        
        // Track the token
        numERC20s++;
        erc20Addresses[numERC20s] = address(token);
        
        emit ERC20NewToken(address(token), config.name, config.symbol, msg.sender, initialBalance);
        
        return address(token);
    }
    
    /**
     * Get the number of deployed ERC20 tokens
     */
    function getNumErc20s() external view returns (uint256) {
        return numERC20s;
    }
    
    /**
     * Get ERC20 token address by index (1-indexed)
     */
    function getErc20Address(uint256 index) external view returns (address) {
        require(index > 0 && index <= numERC20s, "Invalid index");
        return erc20Addresses[index];
    }
    
    /**
     * Get all deployed token addresses
     */
    function getAllErc20Addresses() external view returns (address[] memory) {
        address[] memory tokens = new address[](numERC20s);
        for (uint256 i = 1; i <= numERC20s; i++) {
            tokens[i - 1] = erc20Addresses[i];
        }
        return tokens;
    }
}