pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract WTFFundERC20 is ERC20, Ownable {

    constructor(string memory name, string memory symbol, uint8 decimals_) public ERC20(name, symbol) {
        //        _setupDecimals(decimals_);
    }
    function mint(address _to, uint256 _amount) onlyOwner external {
        _mint(_to, _amount);
    }

    function burn(uint256 _amount) external {
        _burn(msg.sender, _amount);
    }
}
