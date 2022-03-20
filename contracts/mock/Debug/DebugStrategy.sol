// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../../interfaces/harvest/IHarvestVault.sol";
import "../../../interfaces/harvest/IHarvestPool.sol";
import "../../../interfaces/uniswap/Uni.sol";
import "../../../interfaces/uniswap/IUniPair.sol";
import "../../../interfaces/uniswap/IUniStakingRewards.sol";


contract StrategyDebug {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    event AmountLog (
        uint256 indexed _step,
        uint256 _amount
    );

    address public immutable want;
    address public immutable weth;
    address public immutable underlyingToken;
    address public immutable rewardUni;
    address public immutable uniRouter;
    address public immutable uniStakingPool;
    address[] public pathUnderlying;
    address[] public pathWeth;
    string private name = "StrategyDebug";

    uint256 public performanceFee = 500;
    uint256 public immutable performanceMax = 10000;

    uint256 public withdrawalFee = 0;
    uint256 public immutable withdrawalMax = 10000;
    
    address public vault;

    constructor
    (
        address _want,
        address _rewardUni,
        address _uniRouter,
        address _uniStakingPool,
        address[] memory _pathWeth,
        address[] memory _pathUnderlying
    ) 
    public 
    {
        want = _want;
        weth = IUniPair(_want).token0();
        underlyingToken = IUniPair(_want).token1();
        rewardUni = _rewardUni;
        uniRouter = _uniRouter;
        uniStakingPool = _uniStakingPool;  
        pathWeth = _pathWeth;
        pathUnderlying = _pathUnderlying;
    }

    function getName() external view returns (string memory) {
        return name;
    }

    function SetPathUnderlying(address[] memory _path) external {
        pathUnderlying = _path;
    }

    function SetPathWeth(address[] memory _path) external {
        pathWeth = _path;
    }

    function setVault(address _tokenAddr) public {
        require(_tokenAddr == want, "token doesn't match");
        vault = msg.sender;
    }

    function deposit() public {
        uint256 wantAmount = IERC20(want).balanceOf(address(this));
        if (wantAmount > 0) {
            IERC20(want).safeApprove(uniStakingPool, 0);
            IERC20(want).safeApprove(uniStakingPool, wantAmount);
            IUniStakingRewards(uniStakingPool).stake(wantAmount);
        }
    }

    function debug_deposit(uint256 _amount) public {
        IERC20(want).safeApprove(uniStakingPool, 0);
        IERC20(want).safeApprove(uniStakingPool, _amount);
        IUniStakingRewards(uniStakingPool).stake(_amount);
    }

    function withdrawAll() external returns (uint256 balance) {
        IUniStakingRewards(uniStakingPool).exit();
        
        balance = IERC20(want).balanceOf(address(this));
        uint256 rewarAmount = IERC20(rewardUni).balanceOf(address(this));
        IERC20(want).safeTransfer(vault, balance);
        if(rewarAmount > 0) {
            IERC20(rewardUni).safeTransfer(vault, rewarAmount);
        }
    }

    function withdraw(uint256 _amount) external {
        uint256 _balance = IERC20(want).balanceOf(address(this));
        if (_balance < _amount) {
            emit AmountLog(20, _amount);
            IUniStakingRewards(uniStakingPool).withdraw(_amount.sub(_balance));
            _amount = IERC20(want).balanceOf(address(this));
            emit AmountLog(21, _amount);
        }
        IERC20(want).safeTransfer(vault, _amount);
    }

    // function debug_getWithdrawLPAmount(uint256 _amount) public view returns(uint256) {
    //     _amount = _amount.mul(10**18).div(IHarvestVault(farmVault).getPricePerFullShare());
    // }

    function debug_withdrawFromGauge(uint256 _amount) public {
        IUniStakingRewards(uniStakingPool).withdraw(_amount);
    }

    // function debug_withdrawFromVault(uint256 _amount) public {
    //     IHarvestVault(farmVault).withdraw(_amount);
    // }

    function debug_withdrawToken(address _token) public {
        uint256 amount = IERC20(_token).balanceOf(address(this));
        IERC20(_token).safeTransfer(msg.sender, amount);
    }

    function harvest() public {
        IUniStakingRewards(uniStakingPool).getReward();
        uint256 _rewardUni = IERC20(rewardUni).balanceOf(address(this));
        if (_rewardUni > 0) {
            IERC20(rewardUni).safeApprove(uniRouter, 0);
            IERC20(rewardUni).safeApprove(uniRouter, _rewardUni);
            
            Uni(uniRouter).swapExactTokensForTokens(_rewardUni, 1, pathWeth, address(this), block.timestamp);
            uint256 wethAmount = IERC20(weth).balanceOf(address(this));

            IERC20(weth).safeApprove(uniRouter, 0);
            IERC20(weth).safeApprove(uniRouter, wethAmount);

            wethAmount = wethAmount.div(2);
            Uni(uniRouter).swapExactTokensForTokens(wethAmount, 1, pathUnderlying, address(this), block.timestamp);
            uint256 underlyingTokenAmount = IERC20(underlyingToken).balanceOf(address(this));

            IERC20(underlyingToken).safeApprove(uniRouter, 0);
            IERC20(underlyingToken).safeApprove(uniRouter, underlyingTokenAmount);

            Uni(uniRouter).addLiquidity(
                weth,
                underlyingToken,
                wethAmount,
                underlyingTokenAmount, 
                1,  // we are willing to take whatever the pair gives us
                1,  
                address(this),
                block.timestamp
            );
        }
        uint256 harvestAmount = IERC20(want).balanceOf(address(this));
        if (harvestAmount > 0) {
            deposit();
        }
    }

    function debug_getReward() public {
        IUniStakingRewards(uniStakingPool).getReward();
    }

    function debug_swapTokenWeth() public {
        uint256 _rewardUni = IERC20(rewardUni).balanceOf(address(this));
        if (_rewardUni > 0) {
            IERC20(rewardUni).safeApprove(uniRouter, 0);
            IERC20(rewardUni).safeApprove(uniRouter, _rewardUni);
            
            Uni(uniRouter).swapExactTokensForTokens(_rewardUni, 1, pathWeth, address(this), block.timestamp);
        }
    }

    function debug_swapTokenUnderlying() public {
        uint256 wethAmount = IERC20(weth).balanceOf(address(this));
        if (wethAmount > 0) {
            IERC20(weth).safeApprove(uniRouter, 0);
            IERC20(weth).safeApprove(uniRouter, wethAmount);

            wethAmount = wethAmount.div(2);
            Uni(uniRouter).swapExactTokensForTokens(wethAmount, 1, pathUnderlying, address(this), block.timestamp);
        }
    }

    function debug_uniswap() public {
        uint256 _rewardUni = IERC20(rewardUni).balanceOf(address(this));
        if (_rewardUni > 0) {
            IERC20(rewardUni).safeApprove(uniRouter, 0);
            IERC20(rewardUni).safeApprove(uniRouter, _rewardUni);
            
            Uni(uniRouter).swapExactTokensForTokens(_rewardUni, 1, pathWeth, address(this), block.timestamp);
            uint256 wethAmount = IERC20(weth).balanceOf(address(this));

            IERC20(weth).safeApprove(uniRouter, 0);
            IERC20(weth).safeApprove(uniRouter, wethAmount);

            wethAmount = wethAmount.div(2);
            Uni(uniRouter).swapExactTokensForTokens(wethAmount, 1, pathUnderlying, address(this), block.timestamp);
            uint256 underlyingTokenAmount = IERC20(underlyingToken).balanceOf(address(this));

            IERC20(underlyingToken).safeApprove(uniRouter, 0);
            IERC20(underlyingToken).safeApprove(uniRouter, underlyingTokenAmount);

            Uni(uniRouter).addLiquidity(
                weth,
                underlyingToken,
                wethAmount,
                underlyingTokenAmount, 
                1,  // we are willing to take whatever the pair gives us
                1,  
                address(this),
                block.timestamp
            );
        }
    }

    function debug_addLiquidity() public {
        uint256 wethAmount = IERC20(weth).balanceOf(address(this));
        uint256 underlyingTokenAmount = IERC20(underlyingToken).balanceOf(address(this));
        Uni(uniRouter).addLiquidity(
            weth,
            underlyingToken,
            wethAmount,
            underlyingTokenAmount, 
            1,  // we are willing to take whatever the pair gives us
            1,  
            address(this),
            block.timestamp
        );
    }

    function debug_depositHarvest() public {        
        uint256 harvestAmount = IERC20(want).balanceOf(address(this));
        if (harvestAmount > 0) {
            deposit();
        }
    }

    function balanceOfWant() public view returns (uint256) {
        return IERC20(want).balanceOf(address(this));
    }

    function balanceOfPool() public view returns (uint256) {
        return IUniStakingRewards(uniStakingPool).balanceOf(address(this));
    }

    function balanceOf() public view returns (uint256) {
        return balanceOfWant().add(balanceOfPool());
    }
}
