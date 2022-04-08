// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "./MockERC20.sol";
import "./MockCurveDeposit.sol";

contract MockCurveGauge {
    address public crv;
    address public yCRV;

    mapping(address => uint256) balance;

    constructor
    (
        address _crv,
        address _yCRV
    ) public {
        crv = _crv;
        yCRV = _yCRV;
    }

    function deposit(uint256 _amount) external {
        MockERC20(yCRV).transferFrom(msg.sender, address(this), _amount);
        balance[msg.sender] += _amount;
    }

    function withdraw(uint256 _amount) external {
        require(balance[msg.sender] >= _amount, "insufficient");
        MockERC20(yCRV).transfer(msg.sender, _amount);
        balance[msg.sender] -= _amount;
    }

    function balanceOf(address _addr) public view returns (uint256){
        return balance[_addr];
    }
}
