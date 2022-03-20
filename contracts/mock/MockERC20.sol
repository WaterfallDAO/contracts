// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
// 0x6B175474E89094C44Da98b954EedeAC495271d0F
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../interfaces/dforce/Token.sol";

contract MockERC20 is ERC20, dERC20 {

    constructor(string memory name, string memory symbol, uint8 decimals) public ERC20(name, symbol) {
//        _setupDecimals(decimals);
    }

    function mint(address account, uint256 total) override external {
        _mint(account, total);
    }

    function redeem(address account, uint256 amount) override external {

    }

    function getTokenBalance(address account) override external view returns (uint256){
        return 0;
    }

    function getExchangeRate() override external view returns (uint256){
        return 0;
    }

    function burnFor(address _account, uint256 _amount) external {
        _burn(_account, _amount);
    } 
}