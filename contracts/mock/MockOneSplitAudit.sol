// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";

// pls put token in the contract address to ensure that liquidity
contract MockOneSplitAudit {
    using Address for address;
    using SafeMath for uint256;

    function swap(
        address _fromToken,
        address _destToken,
        uint256 _amount,
        uint256 _minReturn,
        uint256[] calldata _distribution,
        uint256 _flags
    ) external payable returns (uint256 returnAmount)
    {
        IERC20(_fromToken).transferFrom(msg.sender, address(this), _amount);
        returnAmount = _amount.div(
            IERC20(_fromToken).balanceOf(address(this))
        ).mul(
            IERC20(_destToken).balanceOf(address(this))
        );
        IERC20(_destToken).transfer(msg.sender, returnAmount);
        // return returnAmount;
    }

    function getExpectedReturn(
        address _fromToken,
        address _destToken,
        uint256 _amount,
        uint256 _parts,
        uint256 _flags // See constants in IOneSplit.sol
    ) external view returns (uint256 returnAmount, uint256[] memory distribution)
    {
        uint256 returnAmount = _amount.div(
            IERC20(_fromToken).balanceOf(address(this))
        ).mul(
            IERC20(_destToken).balanceOf(address(this))
        );
        distribution = new uint256[](1);
        // return returnAmount, uint256 [];
    }
}
