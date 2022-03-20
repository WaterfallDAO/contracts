// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

interface dRewards {
    function withdraw(uint256) external;

    function getReward() external;

    function stake(uint256) external;

    function balanceOf(address) external view returns (uint256);

    function exit() external;
}
