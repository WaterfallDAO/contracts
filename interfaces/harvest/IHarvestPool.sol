pragma solidity ^0.8.4;

interface IHarvestPool {
    function balanceOf(address account) external view returns (uint256);

    function stake(uint256 _amount) external;

    function withdraw(uint256 amount) external ;

    function getReward() external;

    function exit() external;
}