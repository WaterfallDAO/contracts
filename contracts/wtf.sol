pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./Operatable.sol";

contract wtf is ERC20, Operatable {
    using EnumerableSet for EnumerableSet.AddressSet;
    using SafeMath for uint256;

    uint256 public constant MAX_SUPPLY = 13 * 1e8 * 1e18;

    EnumerableSet.AddressSet private _minters;

    constructor()  ERC20("Waterfall", "WTF") {
        super._mint(msg.sender, MAX_SUPPLY);
    }
    function addMinter(address _addMinter) public onlyOperator returns (bool) {
        require(_addMinter != address(0), ": _addMinter is the zero address");
        return EnumerableSet.add(_minters, _addMinter);
    }

    function delMinter(address _delMinter) public onlyOperator returns (bool) {
        require(_delMinter != address(0), ": _delMinter is the zero address");
        return EnumerableSet.remove(_minters, _delMinter);
    }

    function getMinterLength() public view returns (uint256) {
        return EnumerableSet.length(_minters);
    }

    function isMinter(address account) public view returns (bool) {
        return EnumerableSet.contains(_minters, account);
    }

    function getMinter(uint256 _index) public view onlyOperator returns (address){
        require(_index <= getMinterLength() - 1, ": index out of bounds");
        return EnumerableSet.at(_minters, _index);
    }

    // modifier for mint function
    modifier onlyMinter() {
        require(isMinter(msg.sender), "caller is not the minter");
        _;
    }

    function mint(address to, uint256 amount) public onlyMinter returns (bool) {
        if (amount.add(totalSupply()) > MAX_SUPPLY) {
            return false;
        }
        _mint(to, amount);
        return true;
    }

}
