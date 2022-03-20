
pragma solidity ^0.8.4;

interface IVault {
    function token() external view returns (address);

    function balance() external view returns (uint256);

    function deposit(uint256) external;

    function depositAll() external;

    function withdraw(uint256) external;

    function withdrawAll() external;

    function getPricePerFullShare() external view returns (uint256);
}