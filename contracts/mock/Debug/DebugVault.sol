// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
// 0xAa2624b665b78c1049F4c340440660c28af1acde
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./DebugStrategy.sol";

contract DebugVault is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    event AmountLog (
        uint256 indexed _step,
        uint256 _amount
    );

    IERC20 public token;

    uint256 public min = 9500;
    uint256 public constant max = 10000;

    address public governance;
    address public strategy;

    constructor(address _token, address _strategy, string memory _name, string memory _symbol)
        public
        ERC20(_name, _symbol)
    {
//        _setupDecimals(ERC20(_token).decimals());
        token = IERC20(_token);
        governance = msg.sender;
        strategy = _strategy;
        StrategyDebug(strategy).setVault(_token);
    }

    function balance() public view returns (uint256) {
        return token.balanceOf(address(this)).add(StrategyDebug(strategy).balanceOf());
    }

    function setMin(uint256 _min) external {        
        require(_min < max, "inappropriate min reserve token amount");
        min = _min;
    }

    function setStrategy(address _strategy) public {        
        strategy = _strategy;
        StrategyDebug(strategy).setVault(address(token));
    }

    // Custom logic in here for how much the vault allows to be borrowed
    // Sets minimum required on-hand to keep small withdrawals cheap
    function available() public view returns (uint256) {
        return token.balanceOf(address(this)).mul(min).div(max);
    }

    function earn() public {
        uint256 _bal = available();
        token.safeTransfer(strategy, _bal);
        StrategyDebug(strategy).deposit();
    }

    function depositAll() external {
        deposit(token.balanceOf(msg.sender));
    }

    function deposit(uint256 _amount) public nonReentrant {
        uint256 _pool = balance();
        uint256 _before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), _amount);
        uint256 _after = token.balanceOf(address(this));
        _amount = _after.sub(_before); // Additional check for deflationary tokens
        uint256 shares = 0;
        if (totalSupply() == 0) {
            shares = _amount;
        } else {
            shares = (_amount.mul(totalSupply())).div(_pool);
        }
        _mint(msg.sender, shares);
    }

    function withdrawAll() external {
        withdraw(balanceOf(msg.sender));
    }

    // No rebalance implementation for lower fees and faster swaps
    function withdraw(uint256 _shares) public nonReentrant{
        uint256 r = (balance().mul(_shares)).div(totalSupply());
        emit AmountLog(10, r);
        _burn(msg.sender, _shares);

        // Check balance
        uint256 b = token.balanceOf(address(this));
        emit AmountLog(11, b);
        if (b < r) {
            uint256 _withdraw = r.sub(b);
            emit AmountLog(12, _withdraw);
            StrategyDebug(strategy).withdraw(_withdraw);
            uint256 _after = token.balanceOf(address(this));
            emit AmountLog(13, _after);
            uint256 _diff = _after.sub(b);
            emit AmountLog(14, _diff);
            if (_diff < _withdraw) {
                r = b.add(_diff);
            }
        }

        token.safeTransfer(msg.sender, r);
    }

    function getPricePerFullShare() public view returns (uint256) {
        return balance().mul(1e18).div(totalSupply());
    }
}
