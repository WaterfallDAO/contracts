pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "../../interfaces/uniswap/TransferHelper.sol";
import "./WTFFundERC20.sol";
import "../interfaces/IFof.sol";

contract Fund is ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;
    EnumerableSet.AddressSet private stake0Address;
    EnumerableSet.AddressSet private redeem0Address;
    EnumerableSet.AddressSet private stake1Address;
    EnumerableSet.AddressSet private redeem1Address;
    IERC20 public token;
    WTFFundERC20 public tokenA;
    WTFFundERC20 public tokenB;


    uint256 public cycle;
    uint256 public constant DENOMINATOR = 1000;
    uint256 public numerator;

    address public governance;
    address public fof;


    enum poolStatus{
        pending,
        settlement,
        investment
    }

    struct Account {
        uint256 stake;
        uint256 redeem;
        uint256 redeemReserve;
    }

    struct FundPool {
        uint256 currentStake;
        uint256 currentLPToken;
        uint256 mirrorStake;
        uint256 currentRedeem;
        uint256 totalRedeem;
        uint256 currentAmount;
        uint256 lastBillingCycle;
        poolStatus status;
    }

    mapping(address => mapping(uint256 => Account)) public account_;
    mapping(uint256 => FundPool) public fund_;

    event Deposit(address indexed user, uint256 indexed fid, uint256 amount);
    event WithdrawStake(address indexed user, uint256 indexed fid, uint256 amount);
    event WithdrawAmount(address indexed user, uint256 indexed fid, uint256 amount);
    event Claim(address indexed user, uint256 indexed fid, uint256 amount);
    event CancelWithdraw(address indexed user, uint256 indexed fid, uint256 amount);
    event Profit(uint256 amountA, uint256 amountB);
    event Loss(uint256 amountA, uint256 amountB);

    constructor(
        string memory _nameA,
        string memory _symbolA,
        string memory _nameB,
        string memory _symbolB,
        address _token,
        uint256 _cycle,
        address _fof
    ) public {
        tokenA = new WTFFundERC20(_nameA, _symbolA, ERC20(_token).decimals());
        tokenB = new WTFFundERC20(_nameB, _symbolB, ERC20(_token).decimals());
        token = IERC20(_token);
        cycle = _cycle;
        fof = _fof;
        governance = msg.sender;
    }


    function initialize() public {
        require(msg.sender == governance, "!governance");
        FundPool storage fundA = fund_[0];
        FundPool storage fundB = fund_[1];
        fundA.lastBillingCycle = block.timestamp;
        fundB.lastBillingCycle = block.timestamp;
        fundA.status = poolStatus.pending;
        fundB.status = poolStatus.pending;
    }

    function setGovernance(address _governance) public {
        require(msg.sender == governance, "!governance");
        require(_governance != address(0), "Fund: is the zero address");
        governance = _governance;
    }

    function setCycle(uint256 _cycle) public {
        require(msg.sender == governance, "!governance");
        cycle = _cycle;
    }


    function setNumerator(uint256 _newNumerator) public {
        require(msg.sender == governance, "!governance");
        require(_newNumerator <= DENOMINATOR, "Out of range");
        numerator = _newNumerator;
    }


    function setFof(address _fof) public {
        require(msg.sender == governance, "!governance");
        require(_fof != address(0), "Fund: is the zero address");
        fof = _fof;
    }

    function getPoolStatus() public view returns (poolStatus){
        FundPool memory fundA = fund_[0];
        return fundA.status;
    }

    function getActiveLength(EnumerableSet.AddressSet storage _address) private view returns (uint256) {
        return EnumerableSet.length(_address);
    }

    function getLength() public view returns (uint256, uint256, uint256, uint256){
        require(msg.sender == governance, "!governance");
        uint256 stakeA = EnumerableSet.length(stake0Address);
        uint256 stakeB = EnumerableSet.length(stake1Address);
        uint256 redeemA = EnumerableSet.length(redeem0Address);
        uint256 redeemAB = EnumerableSet.length(redeem1Address);
        return (stakeA, stakeB, redeemA, redeemAB);
    }


    function deposit(uint256 _fid, uint256 _amount) public nonReentrant {
        Account storage user = account_[msg.sender][_fid];
        FundPool storage pool = fund_[_fid];
        require(pool.status == poolStatus.pending, "!pending");
        WTFFundERC20 token = _fid == 0 ? tokenA : tokenB;
        uint256 _before = token.balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), _amount);
        uint256 _after = token.balanceOf(address(this));
        _amount = _after.sub(_before);
        if (token.totalSupply() == 0) {
            token.mint(msg.sender, _amount);
            pool.currentLPToken = pool.currentLPToken.add(_amount);
        } else {
            uint256 amount = _amount.mul(token.totalSupply()).div(pool.currentAmount.add(pool.currentStake));
            token.mint(msg.sender, amount);
            pool.currentLPToken = pool.currentLPToken.add(amount);
        }

        user.stake = user.stake.add(_amount);

        pool.currentStake = pool.currentStake.add(_amount);
        pool.mirrorStake = pool.mirrorStake.add(_amount);
        EnumerableSet.AddressSet storage stakeAddress = _fid == 0 ? stake0Address : stake1Address;
        EnumerableSet.add(stakeAddress, msg.sender);
        emit Deposit(msg.sender, _fid, _amount);
    }

    function withdraw(uint256 _fid, uint256 _amount) public nonReentrant {
        Account storage user = account_[msg.sender][_fid];
        FundPool storage pool = fund_[_fid];
        require(pool.status == poolStatus.pending, "!pending");
        WTFFundERC20 token = _fid == 0 ? tokenA : tokenB;
        require(token.balanceOf(msg.sender) >= _amount, "Insufficient balance");
        TransferHelper.safeTransferFrom(address(token), msg.sender, address(this), _amount);
        EnumerableSet.AddressSet storage stakeAddress = _fid == 0 ? stake0Address : stake1Address;
        EnumerableSet.AddressSet storage redeemAddress = _fid == 0 ? redeem0Address : redeem1Address;
        if (user.stake > 0) {

            uint256 amount = user.stake.mul(token.totalSupply()).div(pool.currentAmount.add(pool.currentStake));
            if (amount >= _amount) {
                uint256 redeem = _amount.mul(pool.currentAmount.add(pool.currentStake)).div(token.totalSupply());
                user.stake = user.stake.sub(redeem);
                if (user.stake <= 0) {
                    EnumerableSet.remove(stakeAddress, msg.sender);
                }
                pool.currentStake = pool.currentStake.sub(redeem);
                pool.mirrorStake = pool.mirrorStake.sub(redeem);
                IERC20(token).safeTransfer(msg.sender, redeem);
                emit WithdrawStake(msg.sender, _fid, redeem);
                token.burn(address(this), _amount);
                pool.currentLPToken = pool.currentLPToken.sub(_amount);
            } else {
                pool.currentStake = pool.currentStake.sub(user.stake);
                pool.mirrorStake = pool.mirrorStake.sub(user.stake);
                IERC20(token).safeTransfer(msg.sender, user.stake);
                emit WithdrawStake(msg.sender, _fid, user.stake);
                token.burn(address(this), amount);
                pool.currentLPToken = pool.currentLPToken.sub(amount);
                user.stake = 0;
                EnumerableSet.remove(stakeAddress, msg.sender);
                uint256 result = _amount.sub(amount);
                user.redeem = user.redeem.add(result);
                pool.currentRedeem = pool.currentRedeem.add(result);
                EnumerableSet.add(redeemAddress, msg.sender);
            }
        } else {
            user.redeem = user.redeem.add(_amount);
            pool.currentRedeem = pool.currentRedeem.add(_amount);
            EnumerableSet.add(redeemAddress, msg.sender);
        }
    }


    function isPending() public view returns (bool){
        if (fund_[0].lastBillingCycle.add(cycle) <= block.timestamp) {
            return true;
        }
        return false;
    }

    function startSettle() public {
        require(msg.sender == governance, "!governance");
        require(isPending(), "time is not up yet");
        FundPool storage fundA = fund_[0];
        FundPool storage fundB = fund_[1];
        fundA.status = poolStatus.settlement;
        fundB.status = poolStatus.settlement;
    }

    function startInvest() public {
        require(msg.sender == governance, "!governance");
        require(isPending(), "time is not up yet");
        FundPool storage fundA = fund_[0];
        FundPool storage fundB = fund_[1];
        fundA.status = poolStatus.investment;
        fundB.status = poolStatus.investment;
    }

    function startPending() public {
        require(msg.sender == governance, "!governance");
        FundPool storage fundA = fund_[0];
        FundPool storage fundB = fund_[1];
        require(fundA.status != poolStatus.pending, "Don't repeat");
        require(fundA.currentRedeem == 0 && fundA.currentStake == 0);
        require(fundB.currentRedeem == 0 && fundB.currentStake == 0);
        fundA.status = poolStatus.pending;
        fundB.status = poolStatus.pending;

        fundA.lastBillingCycle = block.timestamp;
        fundB.lastBillingCycle = block.timestamp;
    }

    function earn(uint256 lengthA, uint256 lengthB) public {
        require(msg.sender == governance, "!governance");
        FundPool storage fundA = fund_[0];
        FundPool storage fundB = fund_[1];
        require(fundA.status == poolStatus.investment, "!investment");
        uint256 amountA = fundA.currentStake;
        uint256 amountB = fundB.currentStake;
        uint256 redeem = fundA.totalRedeem.add(fundB.totalRedeem);
        require(amountA > 0 || amountB > 0, "No new investment found");
        uint256 amountAReserve = 0;
        uint256 amountBReserve = 0;
        if (amountA > 0) {
            uint256 length = getActiveLength(stake0Address);
            require(lengthA <= length, "Insufficient users");
            while (lengthA > 0) {
                address sAddress = EnumerableSet.at(stake0Address, 0);
                Account storage user = account_[sAddress][0];
                amountAReserve += user.stake;
                user.stake = 0;
                EnumerableSet.remove(stake0Address, sAddress);
                lengthA--;
            }
        }
        if (amountB > 0) {
            uint256 length = getActiveLength(stake1Address);
            require(lengthB <= length, "Insufficient users");
            while (lengthB > 0) {
                address sAddress = EnumerableSet.at(stake1Address, 0);
                Account storage user = account_[sAddress][1];
                amountBReserve += user.stake;
                user.stake = 0;
                EnumerableSet.remove(stake1Address, sAddress);
                lengthB--;
            }
        }
        uint256 balance = token.balanceOf(address(this));
        uint256 remainder = balance > redeem ? balance.sub(redeem) : 0;
        if (remainder > 0) {
            token.safeTransfer(fof, remainder);
        }
        IFof(fof).earn(amountAReserve, amountBReserve);
        fundA.currentAmount = fundA.currentAmount.add(amountAReserve);
        fundB.currentAmount = fundB.currentAmount.add(amountBReserve);
        fundA.currentStake = fundA.currentStake.sub(amountAReserve);
        fundB.currentStake = fundB.currentStake.sub(amountBReserve);
        if (fundA.currentStake == 0 && fundB.currentStake == 0) {
            fundA.mirrorStake = 0;
            fundB.mirrorStake = 0;
        }
        if (fundA.currentRedeem == 0 && fundB.currentRedeem == 0) {
            fundA.currentLPToken = 0;
            fundB.currentLPToken = 0;
        }
    }


    function handleWithdrawFundA(uint256 lengthA) public {
        require(msg.sender == governance, "!governance");
        FundPool storage fundA = fund_[0];
        require(fundA.status == poolStatus.settlement, "!settlement");
        uint256 amountA = fundA.currentRedeem;
        require(amountA > 0, "No new redeem found");
        uint256 amountAReserve = 0;
        uint256 redeemAReserve = 0;
        if (amountA > 0) {
            uint256 length = getActiveLength(redeem0Address);
            require(lengthA <= length, "Insufficient users");
            while (lengthA > 0) {
                address rAddress = EnumerableSet.at(redeem0Address, 0);
                Account storage user = account_[rAddress][0];

                require(tokenA.totalSupply() > fundA.currentLPToken, "check earn");
                uint256 reserve = user.redeem.mul(fundA.currentAmount).div(tokenA.totalSupply().sub(fundA.currentLPToken));
                amountAReserve += reserve;
                redeemAReserve += user.redeem;
                user.redeemReserve = user.redeemReserve.add(reserve);
                fundA.currentRedeem = fundA.currentRedeem.sub(user.redeem);
                user.redeem = 0;
                EnumerableSet.remove(redeem0Address, rAddress);
                lengthA--;
            }
            fundA.currentAmount = fundA.currentAmount.sub(amountAReserve);
            tokenA.burn(address(this), redeemAReserve);
        }
        if (fundA.mirrorStake >= amountAReserve) {
            fundA.totalRedeem = fundA.totalRedeem.add(amountAReserve);
            fundA.mirrorStake = fundA.mirrorStake.sub(amountAReserve);
            IFof(fof).holdLoss(amountAReserve, 0);
        } else {
            IFof(fof).withdraw(0, amountAReserve.sub(fundA.mirrorStake));
            fundA.mirrorStake = 0;
            fundA.totalRedeem = fundA.totalRedeem.add(amountAReserve);
            IFof(fof).holdLoss(amountAReserve, 0);
        }
        if (fundA.currentRedeem <= 0) {
            fundA.currentLPToken = 0;
        }
    }


    function handleWithdrawFundB(uint256 lengthB) public {
        require(msg.sender == governance, "!governance");
        FundPool storage fundB = fund_[1];
        require(fundB.status == poolStatus.settlement, "!settlement");
        uint256 amountB = fundB.currentRedeem;
        require(amountB > 0, "No new redeem found");
        uint256 amountBReserve = 0;
        uint256 redeemBReserve = 0;
        if (amountB > 0) {
            uint256 length = getActiveLength(redeem1Address);
            require(lengthB <= length, "Insufficient users");
            while (lengthB > 0) {
                address rAddress = EnumerableSet.at(redeem1Address, 0);
                Account storage user = account_[rAddress][1];
                require(tokenB.totalSupply() > fundB.currentLPToken, "check earn");
                uint256 reserve = user.redeem.mul(fundB.currentAmount).div(tokenB.totalSupply().sub(fundB.currentLPToken));
                amountBReserve += reserve;
                redeemBReserve += user.redeem;
                user.redeemReserve = user.redeemReserve.add(reserve);
                fundB.currentRedeem = fundB.currentRedeem.sub(user.redeem);
                user.redeem = 0;
                EnumerableSet.remove(redeem1Address, rAddress);
                lengthB--;
            }
            fundB.currentAmount = fundB.currentAmount.sub(amountBReserve);
            tokenB.burn(address(this), redeemBReserve);
        }
        if (fundB.currentStake >= amountBReserve) {
            fundB.totalRedeem = fundB.totalRedeem.add(amountBReserve);
            fundB.mirrorStake = fundB.mirrorStake.sub(amountBReserve);
            IFof(fof).holdLoss(0, amountBReserve);
        } else {
            IFof(fof).withdraw(1, amountBReserve.sub(fundB.mirrorStake));
            fundB.mirrorStake = 0;
            fundB.totalRedeem = fundB.totalRedeem.add(amountBReserve);
            IFof(fof).holdLoss(0, amountBReserve);
        }
        if (fundB.currentRedeem <= 0) {
            fundB.currentLPToken = 0;
        }
    }


    function claim(uint256 _fid) public {
        Account storage user = account_[msg.sender][_fid];
        FundPool storage pool = fund_[_fid];
        require(pool.status != poolStatus.settlement, "is settlement");
        require(user.redeemReserve > 0, "No amount to collect");
        token.safeTransfer(msg.sender, user.redeemReserve);
        emit Claim(msg.sender, _fid, user.redeemReserve);
        pool.totalRedeem = pool.totalRedeem.sub(user.redeemReserve);
        emit WithdrawAmount(msg.sender, _fid, user.redeemReserve);
        user.redeemReserve = 0;
    }

    function cancelWithdraw(uint256 _fid, uint256 _amount) public {
        Account storage user = account_[msg.sender][_fid];
        FundPool storage pool = fund_[_fid];
        require(pool.status == poolStatus.pending, "!pending");
        WTFFundERC20 token = _fid == 0 ? tokenA : tokenB;
        EnumerableSet.AddressSet storage stakeAddress = _fid == 0 ? stake0Address : stake1Address;
        require(user.redeem >= _amount && pool.currentRedeem >= _amount, "Abnormal amount");
        user.redeem = user.redeem.sub(_amount);
        if (user.redeem <= 0) {
            EnumerableSet.remove(stakeAddress, msg.sender);
        }
        pool.currentRedeem = pool.currentRedeem.sub(_amount);
        TransferHelper.safeTransfer(address(token), msg.sender, _amount);
        emit CancelWithdraw(msg.sender, _fid, _amount);
    }

    function settle() public {
        require(msg.sender == governance, "!governance");
        FundPool storage fundA = fund_[0];
        FundPool storage fundB = fund_[1];
        require(fundB.status == poolStatus.settlement, "!Settlement");
        uint256 fofAssets = IFof(fof).balance();
        uint256 total = fundA.currentAmount.add(fundB.currentAmount);
        require(fofAssets != total, "no change");
        if (fofAssets > total) {
            (uint256 A,uint256 B) = profit(fofAssets.sub(total));
            IFof(fof).holdProfit(A, B);
            emit Profit(A, B);
        } else {
            (uint256 A,uint256 B) = loss(total.sub(fofAssets));
            IFof(fof).holdLoss(A, B);
            emit Loss(A, B);
        }
    }

    function profit(uint256 _amount) private returns (uint256, uint256) {
        FundPool storage fundA = fund_[0];
        FundPool storage fundB = fund_[1];
        uint256 profitA = fundA.currentAmount.mul(_amount).div(fundA.currentAmount.add(fundB.currentAmount));
        uint256 rewardB = profitA.mul(numerator).div(DENOMINATOR);

        uint256 realA = profitA.sub(rewardB);

        fundA.currentAmount = fundA.currentAmount.add(realA);

        uint256 realB = _amount.sub(profitA).add(rewardB);
        fundB.currentAmount = fundB.currentAmount.add(realB);
        return (realA, realB);
    }


    function loss(uint256 _amount) private returns (uint256, uint256) {

        FundPool storage fundA = fund_[0];
        FundPool storage fundB = fund_[1];
        uint256 lossA = fundA.currentAmount.mul(_amount).div(fundA.currentAmount.add(fundB.currentAmount));
        if (lossA >= fundB.currentAmount) {
            uint256 realA = lossA.sub(fundB.currentAmount);
            uint256 lossB = fundB.currentAmount;
            fundA.currentAmount = fundA.currentAmount.sub(realA);
            fundB.currentAmount = 0;
            return (lossA, lossB);
        } else {
            uint256 lossB = _amount;
            if (_amount >= fundB.currentAmount) {
                fundB.currentAmount = 0;
            } else {
                fundB.currentAmount = fundB.currentAmount.sub(_amount);
            }
            return (0, lossB);
        }
    }
}
