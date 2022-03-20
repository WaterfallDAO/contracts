// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./MockERC20.sol";
import "../../interfaces/uniswap/Uni.sol";

contract MockUni is Uni, ERC20 {
    using SafeMath for uint256;
    uint256 public amountOut;
    uint256 public amountIn;
    address public token0;
    address public token1;

    constructor (
        string memory name, string memory symbol, address _token0, address _token1
    ) public ERC20(name, symbol) {
        token0 = _token0;
        token1 = _token1;
    }

    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) override external {
        address tokenIn = path[0];
        address tokenOut = path[path.length - 1];
        ERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        MockERC20(tokenOut).mint(to, amountIn);
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) override external returns (uint amountA, uint amountB, uint liquidity) {

    }
}