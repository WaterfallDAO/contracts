// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./MockERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./MockCurveGauge.sol";

contract MockMinter{

    address public crv;

    constructor(address _crv) public {
        crv = _crv;
    }

    function mint(address _gaugeAddr) external {
        MockERC20(crv).mint(msg.sender, (MockCurveGauge(_gaugeAddr).balanceOf(msg.sender) * 25) / 100);
    }
}