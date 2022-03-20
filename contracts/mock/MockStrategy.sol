// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../interfaces/curve/Curve.sol";
import "../../interfaces/curve/Gauge.sol";
import "../../interfaces/uniswap/Uni.sol";

import "../../interfaces/yearn/IController.sol";
import "../../interfaces/yearn/Mintr.sol";

// 0x0750d20f904CF80C98C34e2bb43A3474Fd1Af61d
contract MockStrategy {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    uint256 public constant N_COINS = 4;
    int128 public immutable WANT_COIN_INDEX;
    address public immutable want;
    address public immutable curveDeposit;
    address public immutable gauge;
    address public immutable mintr;
    address public immutable crv;
    address public immutable crvLP;
    address public immutable uni;
    address public immutable weth;
    string private name;

    address[] public coins;
    uint256[4] public ZEROS = [uint256(0), uint256(0), uint256(0), uint256(0)];

    uint256 public performanceFee = 500;
    uint256 public immutable performanceMax = 10000;

    uint256 public withdrawalFee = 50;
    uint256 public immutable withdrawalMax = 10000;

    address public governance;
    address public controller;
    address public strategist;

    constructor
    (
        address _controller,
        string memory _name,
        int128 _wantCoinIndex,
        address[] memory _coins,
        address _curveDeposit,
        address _gauge,
        address _crvLP,
        address _crv,
        address _uni,
        address _mintr,
        address _weth
    )
    public
    {
        governance = msg.sender;
        strategist = msg.sender;
        controller = _controller;
        name = _name;
        WANT_COIN_INDEX = _wantCoinIndex;
        want = _coins[uint128(_wantCoinIndex)];
        coins = _coins;
        curveDeposit = _curveDeposit;
        gauge = _gauge;
        crvLP = _crvLP;
        crv = _crv;
        uni = _uni;
        mintr = _mintr;
        weth = _weth;
    }

    function getName() external view returns (string memory) {
        return name;
    }

    function setStrategist(address _strategist) external {
        require(msg.sender == governance, "!governance");
        strategist = _strategist;
    }

    function setWithdrawalFee(uint256 _withdrawalFee) external {
        require(msg.sender == governance, "!governance");
        withdrawalFee = _withdrawalFee;
    }

    function setPerformanceFee(uint256 _performanceFee) external {
        require(msg.sender == governance, "!governance");
        performanceFee = _performanceFee;
    }

    function deposit() public {
        _deposit(uint128(WANT_COIN_INDEX));
    }

    function _deposit(uint256 _coinIndex) internal {
        require(_coinIndex < N_COINS, "index exceeded bound");
        address coinAddr = coins[_coinIndex];
        uint256 wantAmount = IERC20(coinAddr).balanceOf(address(this));
        if (wantAmount > 0) {
            IERC20(coinAddr).safeApprove(curveDeposit, 0);
            IERC20(coinAddr).safeApprove(curveDeposit, wantAmount);
            uint256[N_COINS] memory amounts = ZEROS;
            amounts[_coinIndex] = wantAmount;
            // TODO: add minimun mint amount if required
            ICurveDeposit(curveDeposit).add_liquidity(amounts, 0);
        }
        uint256 crvLPAmount = IERC20(crvLP).balanceOf(address(this));
        if (crvLPAmount > 0) {
            IERC20(crvLP).safeApprove(gauge, 0);
            IERC20(crvLP).safeApprove(gauge, crvLPAmount);
            Gauge(gauge).deposit(crvLPAmount);
        }
    }

    // Withdraw all funds, normally used when migrating strategies
    function withdrawAll() external returns (uint256 balance) {
        require(msg.sender == controller, "!controller");
        uint256 _amount = Gauge(gauge).balanceOf(address(this));
        _withdrawSome(_amount);

        balance = IERC20(want).balanceOf(address(this));

        address _vault = IController(controller).vaults(address(want));
        require(_vault != address(0), "!vault");
        // additional protection so we don't burn the funds
        IERC20(want).safeTransfer(_vault, balance);
    }

    function withdraw(uint256 _amount) external {
        require(msg.sender == controller, "!controller");
        uint256 _balance = IERC20(want).balanceOf(address(this));
        if (_balance < _amount) {
            _amount = _withdrawSome(_amount.sub(_balance));
            _amount = _amount.add(_balance);
        }
        address _vault = IController(controller).vaults(address(want));
        IERC20(want).safeTransfer(_vault, _amount);
    }

    function _withdrawSome(uint256 _amount) internal returns (uint256) {
        uint256 rate = ICurveDeposit(curveDeposit).calc_withdraw_one_coin(10 ** 18, WANT_COIN_INDEX);
        _amount = _amount.mul(10 ** 18).div(rate);
        Gauge(gauge).withdraw(_amount);
        IERC20(crvLP).safeApprove(curveDeposit, 0);
        IERC20(crvLP).safeApprove(curveDeposit, _amount);
        // TODO: add minimun mint amount if required
        ICurveDeposit(curveDeposit).remove_liquidity_one_coin(_amount, WANT_COIN_INDEX, 0);
        return ICurveDeposit(curveDeposit).calc_withdraw_one_coin(_amount, WANT_COIN_INDEX);
    }

    // Controller only function for creating additional rewards from dust
    function withdraw(IERC20 _asset) external returns (uint256 balance) {
        require(msg.sender == controller, "!controller");
        for (uint i = 0; i < N_COINS; ++i) {
            require(coins[i] != address(_asset), "internal token");
        }
        require(crv != address(_asset), "crv");
        require(crvLP != address(_asset), "crvLP");
        balance = _asset.balanceOf(address(this));
        _asset.safeTransfer(controller, balance);
    }

    function harvest(uint _coinIndex) public {
        require(_coinIndex < N_COINS, "index exceeded bound");
        require(msg.sender == strategist || msg.sender == governance, "!authorized");
        Mintr(mintr).mint(gauge);
        address harvestingCoin = coins[_coinIndex];
        uint256 _crv = IERC20(crv).balanceOf(address(this));
        if (_crv > 0) {

            IERC20(crv).safeApprove(uni, 0);
            IERC20(crv).safeApprove(uni, _crv);

            address[] memory path = new address[](3);
            path[0] = crv;
            path[1] = weth;
            path[2] = harvestingCoin;
            // TODO: add minimun mint amount if required
            Uni(uni).swapExactTokensForTokens(_crv, uint256(0), path, address(this), block.timestamp.add(1800));
        }
        uint256 harvestAmount = IERC20(harvestingCoin).balanceOf(address(this));
        if (harvestAmount > 0) {
            uint256 _fee = harvestAmount.mul(performanceFee).div(performanceMax);
            IERC20(harvestingCoin).safeTransfer(IController(controller).rewards(), _fee);
            _deposit(_coinIndex);
        }
    }

    function balanceOfWant() public view returns (uint256) {
        return IERC20(want).balanceOf(address(this));
    }

    function balanceOfGauge() public view returns (uint256) {
        return Gauge(gauge).balanceOf(address(this));
    }

    function balanceOfPool() public view returns (uint256) {
        return ICurveDeposit(curveDeposit).calc_withdraw_one_coin(balanceOfGauge(), WANT_COIN_INDEX);
    }

    function balanceOf() public view returns (uint256) {
        return balanceOfWant().add(balanceOfPool());
    }

    function setGovernance(address _governance) external {
        require(msg.sender == governance, "!governance");
        governance = _governance;
    }

    function setController(address _controller) external {
        require(msg.sender == governance, "!governance");
        controller = _controller;
    }
}
