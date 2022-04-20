pragma solidity ^0.8.4;


interface IFof {
    function earn(uint256 amountA, uint256 amountB) external;

    function withdraw(uint256 fid, uint256 amount) external;

    function withdrawAll() external;

    function holdProfit(uint256 amountA, uint256 amountB) external;

    function holdLoss(uint256 amountA, uint256 amountB) external;

    function balance() external view returns (uint256);
}
