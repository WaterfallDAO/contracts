// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./MockERC20.sol";

contract MockHarvestVault is ERC20 {
    address public underlying;
    address public lp;

    constructor(address _underlying, address _lp) ERC20("harvest", "harvest") {
        underlying = _underlying;
        lp = _lp;
    }

    function mint(address account, uint256 total) external {
        _mint(account, total);
    }

    function deposit(uint256 _amount) external {
        IERC20(underlying).transferFrom(msg.sender, address(this), _amount);
        MockERC20(lp).mint(msg.sender, _amount);
    }


    function withdraw(uint256 numberOfShares) external {
        MockERC20(lp).burnFor(msg.sender, numberOfShares);
        IERC20(underlying).transfer(msg.sender, numberOfShares);
    }

    function getPricePerFullShare() external view returns (uint256) {
        return 10 ** 18;
    }
}
