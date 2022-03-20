pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "../interfaces/IVault.sol";


contract Fof {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    IERC20 public token;

    address public governance;
    address public vault;
    address public fund;

    mapping(uint256 => uint256) public hold;
    mapping(uint256 => uint256) public vaultLP;

    constructor(address _token) public {
        token = IERC20(_token);
        governance = msg.sender;
    }

    function setGovernance(address _governance) public {
        require(governance == msg.sender, "!governance");
        require(_governance != address(0), "is the zero address");
        governance = _governance;
    }

    function setVault(address _vault) public {
        require(governance == msg.sender, "!governance");
        require(_vault != address(0), "is the zero address");
        vault = _vault;
        token.safeApprove(_vault, 2**256 - 1);
    }

    function setFund(address _fund) public {
        require(governance == msg.sender, "!governance");
        require(_fund != address(0), "is the zero address");
        fund = _fund;
    }

    function earn(uint256 _amountA, uint256 _amountB) external {
        require(msg.sender == fund, "Insufficient permissions");
        hold[0] = hold[0].add(_amountA);
        hold[1] = hold[1].add(_amountB);
        if (token.balanceOf(address(this)) > 0) {
            IVault(vault).deposit(token.balanceOf(address(this)));
        }
        distribution();
    }

    function holdProfit(uint256 _amountA, uint256 _amountB) external {
        require(msg.sender == fund, "Insufficient permissions");
        require(_amountA > 0 || _amountB > 0, "Not update");
        hold[0] = hold[0].add(_amountA);
        hold[1] = hold[1].add(_amountB);
        distribution();
    }

    function holdLoss(uint256 _amountA, uint256 _amountB) external {
        require(msg.sender == fund, "Insufficient permissions");
        require(hold[0] >= _amountA && hold[1] >= _amountB, "Insufficient balance");
        hold[0] = hold[0].sub(_amountA);
        hold[1] = hold[1].sub(_amountB);
        distribution();
    }

    function distribution() private {
        uint256 vlp = ERC20(vault).balanceOf(address(this));
        uint256 total = hold[0].add(hold[1]) == 0 ? 1 : hold[0].add(hold[1]);
        vaultLP[0] = hold[0].mul(vlp).div(total);
        vaultLP[1] = vlp.sub(vaultLP[0]);
    }

    function balance() public view returns (uint256){
        return IVault(vault).balance().add(token.balanceOf(address(this)));
    }

    function withdraw(uint256 _fid, uint256 _amount) external {
        require(msg.sender == fund, "Insufficient permissions");
        require(hold[_fid] >= _amount, "Insufficient balance");
        if (token.balanceOf(address(this)) >= _amount) {
            token.safeTransfer(fund, _amount);
        } else {
            uint256 real = _amount.sub(token.balanceOf(address(this)));
            uint256 share = real.mul(vaultLP[_fid]).div(hold[_fid]);
            IVault(vault).withdraw(share);
            token.safeTransfer(fund, _amount);
        }
    }

    function withdrawAll() external {
        require(msg.sender == governance, "Insufficient permissions");
        IVault(vault).withdrawAll();
    }

}
