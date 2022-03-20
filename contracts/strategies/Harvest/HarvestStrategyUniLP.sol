// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../../interfaces/yearn/IController.sol";
import "../../../interfaces/harvest/IHarvestVault.sol";
import "../../../interfaces/harvest/IHarvestPool.sol";
import "../../../interfaces/uniswap/Uni.sol";
import "../../../interfaces/uniswap/IUniPair.sol";

contract HarvestStrategyUniLP {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public immutable want;
    address public immutable weth;
    address public immutable underlyingToken;
    address public immutable farm;
    address public immutable farmVault;
    address public immutable farmPool;

    address public immutable uniRouter;
    address[] public pathUnderlying;
    address[] public pathWeth;
    string private name;

    uint256 public performanceFee = 500;
    uint256 public immutable performanceMax = 10000;

    uint256 public withdrawalFee = 0;
    uint256 public immutable withdrawalMax = 10000;

    address public governance;
    address public controller;
    address public timelock;

    constructor
    (
        address _controller,
        string memory _name,
        address _want,
        address _farmVault,
        address _farmPool,
        address _farm,
        address _uniRouter,
        address[] memory _pathWeth,
        address[] memory _pathUnderlying,
        address _timelock
    )
    public
    {
        governance = msg.sender;
        controller = _controller;
        name = _name;
        want = _want;
        farmVault = _farmVault;
        farmPool = _farmPool;
        farm = _farm;
        weth = IUniPair(_want).token0();
        underlyingToken = IUniPair(_want).token1();
        uniRouter = _uniRouter;
        pathWeth = _pathWeth;
        pathUnderlying = _pathUnderlying;
        timelock = _timelock;
    }

    function getName() external view returns (string memory) {
        return name;
    }

    function setWithdrawalFee(uint256 _withdrawalFee) external {
        require(msg.sender == governance, "!governance");
        require(_withdrawalFee < withdrawalMax, "inappropriate withdraw fee");
        withdrawalFee = _withdrawalFee;
    }

    function setPerformanceFee(uint256 _performanceFee) external {
        require(msg.sender == governance, "!governance");
        require(_performanceFee < performanceMax, "inappropriate performance fee");
        performanceFee = _performanceFee;
    }

    function SetPathWeth(address[] memory _path) external {
        require(msg.sender == governance, "!governance");
        pathWeth = _path;
    }

    function SetPathUnderlying(address[] memory _path) external {
        require(msg.sender == governance, "!governance");
        pathUnderlying = _path;
    }

    function deposit() public {
        uint256 wantAmount = IERC20(want).balanceOf(address(this));
        if (wantAmount > 0) {
            IERC20(want).safeApprove(farmVault, 0);
            IERC20(want).safeApprove(farmVault, wantAmount);
            IHarvestVault(farmVault).deposit(wantAmount);
        }
        uint256 lpAmount = IERC20(farmVault).balanceOf(address(this));
        if (lpAmount > 0) {
            IERC20(farmVault).safeApprove(farmPool, 0);
            IERC20(farmVault).safeApprove(farmPool, lpAmount);
            IHarvestPool(farmPool).stake(lpAmount);
        }
    }

    // Withdraw all funds, normally used when migrating strategies
    function withdrawAll() external returns (uint256 balance) {
        require(msg.sender == controller, "!controller");
        IHarvestPool(farmPool).exit();
        uint256 _amount = IERC20(farmVault).balanceOf(address(this));
        IHarvestVault(farmVault).withdraw(_amount);

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
            _withdrawSome(_amount.sub(_balance));
            _amount = IERC20(want).balanceOf(address(this));
        }
        uint256 _fee = _amount.mul(withdrawalFee).div(withdrawalMax);
        IERC20(want).safeTransfer(IController(controller).rewards(), _fee);
        address _vault = IController(controller).vaults(address(want));
        require(_vault != address(0), "!vault");
        // additional protection so we don't burn the funds

        IERC20(want).safeTransfer(_vault, _amount.sub(_fee));
    }

    function _withdrawSome(uint256 _amount) internal {
        _amount = _amount.mul(10 ** 18).div(IHarvestVault(farmVault).getPricePerFullShare());
        if (_amount > balanceOfPool()) {
            _amount = balanceOfPool();
        }
        IHarvestPool(farmPool).withdraw(_amount);
        IHarvestVault(farmVault).withdraw(_amount);
    }

    // Controller only function for creating additional rewards from dust
    function withdraw(IERC20 _asset) external returns (uint256 balance) {
        require(msg.sender == controller, "!controller");
        require(want != address(_asset), "want");
        require(farm != address(_asset), "farm");
        require(farmVault != address(_asset), "farmVault");
        balance = _asset.balanceOf(address(this));
        _asset.safeTransfer(controller, balance);
    }

    function harvest() public {
        IHarvestPool(farmPool).getReward();
        uint256 _farm = IERC20(farm).balanceOf(address(this));
        if (_farm > 0) {
            IERC20(farm).safeApprove(uniRouter, 0);
            IERC20(farm).safeApprove(uniRouter, _farm);

            Uni(uniRouter).swapExactTokensForTokens(_farm, 1, pathWeth, address(this), block.timestamp + 1000);
            uint256 wethAmount = IERC20(weth).balanceOf(address(this));

            IERC20(weth).safeApprove(uniRouter, 0);
            IERC20(weth).safeApprove(uniRouter, wethAmount);

            wethAmount = wethAmount.div(2);
            Uni(uniRouter).swapExactTokensForTokens(wethAmount, 1, pathUnderlying, address(this), block.timestamp + 1000);
            uint256 underlyingTokenAmount = IERC20(underlyingToken).balanceOf(address(this));

            IERC20(underlyingToken).safeApprove(uniRouter, 0);
            IERC20(underlyingToken).safeApprove(uniRouter, underlyingTokenAmount);

            Uni(uniRouter).addLiquidity(
                weth,
                underlyingToken,
                wethAmount,
                underlyingTokenAmount,
                1, // we are willing to take whatever the pair gives us
                1,
                address(this),
                block.timestamp + 1000
            );
        }
        uint256 harvestAmount = IERC20(want).balanceOf(address(this));
        if (harvestAmount > 0) {
            uint256 _fee = harvestAmount.mul(performanceFee).div(performanceMax);
            IERC20(want).safeTransfer(IController(controller).rewards(), _fee);
            deposit();
        }
    }

    function balanceOfWant() public view returns (uint256) {
        return IERC20(want).balanceOf(address(this));
    }

    function balanceOfPool() public view returns (uint256) {
        return IHarvestPool(farmPool).balanceOf(address(this))
        .mul(IHarvestVault(farmVault).getPricePerFullShare())
        .div(10 ** 18);
    }

    function balanceOf() public view returns (uint256) {
        return balanceOfWant().add(balanceOfPool());
    }

    function setGovernance(address _governance) external {
        require(msg.sender == timelock, "!timelock");
        governance = _governance;
    }

    function setController(address _controller) external {
        require(msg.sender == timelock, "!timelock");
        controller = _controller;
    }

    function setTimelock(address _timelock) public {
        require(msg.sender == timelock, "!timelock");
        timelock = _timelock;
    }
}
