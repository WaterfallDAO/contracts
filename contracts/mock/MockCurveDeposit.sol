// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "./MockERC20.sol";

contract MockCurveDeposit {
    address[3] public coins;
    address public crvLP;

    constructor
    (
        address[3] memory _coins,
        address _crvLP
    ) public {
        coins = _coins;
        crvLP = _crvLP;
    }

    function get_virtual_price() public view returns (uint256){
        return 1e18;
    }

    function add_liquidity
    (
        uint256[3] calldata _amounts,
        uint256 _min_mint_amount
    ) external {
        for (uint i = 0; i < 3; ++i) {
            if (_amounts[i] > 0) {
                MockERC20(coins[i]).transferFrom(msg.sender, address(this), _amounts[i]);
                uint256 rate = (_amounts[i] * 10 ** 18) / _calc_withdraw_one_coin(_amounts[i], int128(uint128(i)));
                MockERC20(crvLP).mint(msg.sender, (_amounts[i] * rate) / 10 ** 18);
            }
        }
    }

    function remove_liquidity_one_coin
    (
        uint256 _amount,
        int128 _i,
        uint256 _min_uamount
    )
    external {
        MockERC20(crvLP).transferFrom(msg.sender, address(this), _amount);
        MockERC20(coins[uint128(_i)]).mint(msg.sender, _calc_withdraw_one_coin(_amount, int128(uint128(_i))));
    }

    function calc_withdraw_one_coin(uint256 _amount, int128 _index) external view returns (uint256){
        return _calc_withdraw_one_coin(_amount, _index);
    }

    function _calc_withdraw_one_coin(uint256 _amount, int128 _index) internal view returns (uint256){
        return (_amount * 1001) / 1000;
    }

    function getRate
    (
        uint256[3] calldata _amounts,
        uint256 _min_mint_amount
    ) external view returns (uint256[3] memory) {
        uint256[3] memory ret;
        for (uint i = 0; i < 3; ++i) {
            ret[i] = (_amounts[i] * 10 ** 18) / _calc_withdraw_one_coin(_amounts[i], int128(uint128(i)));
        }
        return ret;
    }

    function getcrvLPReturn
    (
        uint256[3] calldata _amounts,
        uint256 _min_mint_amount
    ) external view returns (uint256[3] memory) {
        uint256[3] memory ret;
        for (uint i = 0; i < 3; ++i) {
            uint256 rate = (_amounts[i] * 10 ** 18) / _calc_withdraw_one_coin(_amounts[i], int128(uint128(i)));
            ret[i] = (_amounts[i] * rate) / 10 ** 18;
        }
        return ret;
    }
}
