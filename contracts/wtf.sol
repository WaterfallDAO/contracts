pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract wtf is ERC20 {
    uint256 public constant MAX_SUPPLY = 13 * 1e8 * 1e18;
    constructor()  ERC20("Waterfall", "WTF") {
        super._mint(msg.sender, MAX_SUPPLY);
    }
}
