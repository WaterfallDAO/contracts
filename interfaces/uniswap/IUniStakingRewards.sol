// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

interface IUniStakingRewards {
    function balanceOf(address account) external view returns (uint256);

    function stake(uint256 amount) external;

    function withdraw(uint256 amount) external;

    function getReward() external;

    function exit() external;
}
