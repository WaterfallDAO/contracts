// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../../interfaces/dforce/Rewards.sol";

contract MockReward is dRewards {

    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 private _totalSupply;

    address public lp;
    address public df;

    mapping(address => uint256) private _balances;

    constructor(address lpAddress, address dfAddress) public {
        lp = lpAddress;
        df = dfAddress;
    }

    function withdraw(uint256 amount) override external {
        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = _balances[msg.sender].sub(amount);
//        lp.safeTransfer(msg.sender, amount);
    }

    function getReward() override external {

//        uint256 reward = earned(msg.sender);
//        if (reward > 0) {
//            rewards[msg.sender] = 0;
//            df.safeTransfer(msg.sender, reward);
//            emit RewardPaid(msg.sender, reward);
//        }

    }

    function earned(address account)  public view returns (uint256) {
        return 1;
        //        return balanceOf(account).div(1e18).add(1);
    }

    function stake(uint256 amount) override external {
        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);
//        lp.safeTransferFrom(msg.sender, address(this), amount);

    }

    function balanceOf(address account) override external view returns (uint256){
        return _balances[account];
    }

    function exit() override external {
        //        withdraw(balanceOf(msg.sender));
        //        getReward();

    }
}