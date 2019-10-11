pragma solidity ^0.4.19;

import "./SafeMath.sol";
import "./PermissionGroups.sol";


contract TST20 {
  uint public totalSupply;
  function balanceOf(address who) public view returns (uint);
  function transfer(address to, uint value) public;
  function allowance(address owner, address spender) public view returns (uint);
  function transferFrom(address from, address to, uint value) public;
  function approve(address spender, uint value) public;

  event Transfer(address indexed from, address indexed to, uint value);
  event Approval(address indexed owner, address indexed spender, uint value);
}

contract StandardToken is TST20, PermissionGroups {

    using SafeMath for uint;
    mapping(address => mapping (address => uint)) allowed;
    mapping(address => uint) balances;
    
    function transfer(address _to, uint _value) public{
        require(_value > 0 && _to != address(0));
        balances[msg.sender] = balances[msg.sender].sub(_value);
        balances[_to] = balances[_to].add(_value);
        Transfer(msg.sender, _to, _value);
    }

    function balanceOf(address _owner) public view returns (uint balance) {
        return balances[_owner];
    }

    function transferFrom(address _from, address _to, uint _value) public {
        require(_value > 0 && _to != address(0));
        
        balances[_to] = balances[_to].add(_value);
        balances[_from] = balances[_from].sub(_value);
        allowed[_from][msg.sender] = allowed[_from][msg.sender].sub(_value);
        Transfer(_from, _to, _value);
    }

    function approve(address _spender, uint _value) public{
        require((_value == 0) || (allowed[msg.sender][_spender] == 0)) ;
        allowed[msg.sender][_spender] = _value;
        Approval(msg.sender, _spender, _value);
    }

    function allowance(address _owner, address _spender) public constant returns (uint remaining) {
        return allowed[_owner][_spender];
    }
}

contract CFIAT is StandardToken {
    string public name = "CFIAT";
    string public symbol = "CFIAT";
    uint public constant decimals = 18;

    function CFIAT() public {
        totalSupply = 0; //2500000000*10**decimals;
        balances[msg.sender] = totalSupply; //Send all tokens to owner
    }

    function setName(string _name) onlyAdmin public {
        name = _name;
    }

    function setSymbol(string _symbol) onlyAdmin public {
        symbol = _symbol;
    }

    function create(address _addr, uint _value) onlyOperator public returns (bool) {
        balances[_addr] = balances[_addr].add(_value);
        totalSupply = totalSupply.add(_value);
        Transfer( address(0), _addr, _value);
        return true;
    }

    function burn(address _addr, uint _value) onlyOperator public returns (bool) {
        balances[_addr] = balances[_addr].sub(_value);
        totalSupply = totalSupply.sub(_value);
        Transfer(_addr, address(0), _value);
        return true;
    }
  
    //Transfer TTC or other token balance to owner
    function claimToken(address _tokenAddress) onlyAdmin public {
        if(_tokenAddress == address(0)){
            require(admin.send(address(this).balance));
            return;
        }
        TST20 token = TST20(_tokenAddress);
        uint256 balance = token.balanceOf(this);
        token.transfer(admin, balance);
    }
    
    //Accept TTC transfer
    function() payable public{
    }

}