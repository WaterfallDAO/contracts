// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../../interfaces/yearn/Converter.sol";

contract MockConverter {
    address public input;
    address public output;
    address public strategy;



    constructor(address _input, address _output) public {
        input = _input;
        output = _output;


    }
    function convert(address _strategy) external returns (uint256 balance){
       balance =  Converter(address(this)).convert(_strategy);


    }


}
