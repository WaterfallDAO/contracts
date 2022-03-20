pragma solidity ^0.8.4;

import "./MockERC20.sol";

contract MockHarvestPool {
    address public lp;
    address public farm;
    address public strategy;

    mapping(address => uint256) public balanceOf;

    constructor(address _lp, address _farm) public {
        lp = _lp;
        farm = _farm;
    }

    // function balanceOf(address account) external view returns (uint256);

    function stake(uint256 _amount) public {
        IERC20(lp).transferFrom(msg.sender, address(this), _amount);
        balanceOf[msg.sender] += _amount;
    }

    function setStrategy(address _strategy) public {
        require(_strategy != address(0), "!zero");
        strategy = _strategy;
    }

    function earn() public {
        uint256 _bal = IERC20(lp).balanceOf(address(this));
        IERC20(lp).transfer(strategy, _bal);
    }

    function withdraw(uint256 _amount) public {
        require(_amount <= balanceOf[msg.sender], "incufficient balance");
        IERC20(lp).transfer(msg.sender, _amount);
        balanceOf[msg.sender] -= _amount;
    }

    function getReward() public {
        MockERC20(farm).mint(msg.sender, (balanceOf[msg.sender] * 2) / 10);
    }

    function exit() public {
        withdraw(balanceOf[msg.sender]);
        getReward();
    }
}