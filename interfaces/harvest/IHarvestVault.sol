pragma solidity ^0.8.4;

interface IHarvestVault {
    function deposit(uint256 amount) external;

    function withdraw(uint256 numberOfShares) external;

    function getPricePerFullShare() external view returns (uint256);
}