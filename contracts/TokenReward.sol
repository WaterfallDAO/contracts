// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "../lib/TransferHelper.sol";
import "../interfaces/IMinterToken.sol";
import "./Operatable.sol";

abstract contract TokenReward is Operatable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IMinterToken public swapToken;

    uint256 public tokenPerBlock;

    uint256 public immutable startBlock;
    uint public periodEndBlock;
    uint256 public period;

    uint256 public minTokenReward = 3.75e17;

    constructor(IMinterToken _swapToken,
        uint256 _tokenPerBlock,
        uint256 _startBlock,
        uint256 _period){
        swapToken = _swapToken;
        tokenPerBlock = _tokenPerBlock;
        startBlock = _startBlock;
        period = _period;
        periodEndBlock = _startBlock.add(_period);
    }

    modifier reduceBlockReward()  {
        if (block.number > startBlock && block.number >= periodEndBlock) {
            if (tokenPerBlock > minTokenReward) {
                tokenPerBlock = tokenPerBlock.mul(75).div(100);
            }
            if (tokenPerBlock < minTokenReward) {
                tokenPerBlock = minTokenReward;
            }
            periodEndBlock = block.number.add(period);
        }
        _;
    }

    function setHalvingPeriod(uint256 _block) public onlyOperator {
        period = _block;
    }

    function setMinTokenReward(uint256 _reward) public onlyOperator {
        minTokenReward = _reward;
    }

    // Set the number of swap produced by each block
    function setTokenPerBlock(uint256 _newPerBlock, bool _withUpdate) public onlyOperator {
        if (_withUpdate) {
            massUpdatePools();
        }
        tokenPerBlock = _newPerBlock;
    }

    function massUpdatePools() public virtual;


}