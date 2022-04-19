// SPDX-License-Identifier: GPL-3.0


pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./ConstantMixin.sol";


abstract contract AbstractSwapperBase is ConstantMixin {
    using SafeERC20 for ERC20;

    receive() external payable {}

    function __swapAssets(
        address payable _trader,
        address _srcToken,
        uint256 _srcAmount,
        address _destToken,
        uint256 _actualRate
    ) internal returns (uint256 destAmount_) {
        address[] memory assetsToIntegratee = new address[](1);
        assetsToIntegratee[0] = _srcToken;
        uint256[] memory assetsToIntegrateeAmounts = new uint256[](1);
        assetsToIntegrateeAmounts[0] = _srcAmount;

        address[] memory assetsFromIntegratee = new address[](1);
        assetsFromIntegratee[0] = _destToken;
        uint256[] memory assetsFromIntegrateeAmounts = new uint256[](1);
        assetsFromIntegrateeAmounts[0] = _actualRate;
        __swap(
            _trader,
            assetsToIntegratee,
            assetsToIntegrateeAmounts,
            assetsFromIntegratee,
            assetsFromIntegrateeAmounts
        );

        return assetsFromIntegrateeAmounts[0];
    }

    function __swap(
        address payable _trader,
        address[] memory _assetsToIntegratee,
        uint256[] memory _assetsToIntegrateeAmounts,
        address[] memory _assetsFromIntegratee,
        uint256[] memory _assetsFromIntegrateeAmounts
    ) internal {
        // Take custody of incoming assets
        for (uint256 i = 0; i < _assetsToIntegratee.length; i++) {
            address asset = _assetsToIntegratee[i];
            uint256 amount = _assetsToIntegrateeAmounts[i];

            require(asset != address(0), " empty value in _assetsToIntegratee");
            require(amount > 0, " empty value in _assetsToIntegrateeAmounts");

            // Incoming ETH amounts can be ignored
            if (asset == MAX_ADDRESS) {
                continue;
            }
            ERC20(asset).safeTransferFrom(_trader, address(this), amount);
        }

        // Distribute outgoing assets
        for (uint256 i = 0; i < _assetsFromIntegratee.length; i++) {
            address asset = _assetsFromIntegratee[i];
            uint256 amount = _assetsFromIntegrateeAmounts[i];

            require(asset != address(0), " empty value in _assetsFromIntegratee");
            require(amount > 0, " empty value in _assetsFromIntegrateeAmounts");

            if (asset == MAX_ADDRESS) {
                _trader.transfer(amount);
            } else {
                ERC20(asset).safeTransfer(_trader, amount);
            }
        }
    }
}
