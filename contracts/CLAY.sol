pragma solidity ^0.4.19;


library SafeMath {
  function mul(uint a, uint b) internal pure  returns (uint) {
    uint c = a * b;
    require(a == 0 || c / a == b);
    return c;
  }
  function div(uint a, uint b) internal pure returns (uint) {
    require(b > 0);
    uint c = a / b;
    require(a == b * c + a % b);
    return c;
  }
  function sub(uint a, uint b) internal pure returns (uint) {
    require(b <= a);
    return a - b;
  }
  function add(uint a, uint b) internal pure returns (uint) {
    uint c = a + b;
    require(c >= a);
    return c;
  }
  function max64(uint64 a, uint64 b) internal  pure returns (uint64) {
    return a >= b ? a : b;
  }
  function min64(uint64 a, uint64 b) internal  pure returns (uint64) {
    return a < b ? a : b;
  }
  function max256(uint256 a, uint256 b) internal  pure returns (uint256) {
    return a >= b ? a : b;
  }
  function min256(uint256 a, uint256 b) internal  pure returns (uint256) {
    return a < b ? a : b;
  }
}


contract Ownable {
    address public owner;

    function Ownable() public{
        owner = msg.sender;
    }

    modifier onlyOwner {
        require(msg.sender == owner);
        _;
    }
    function transferOwnership(address newOwner) onlyOwner public{
        if (newOwner != address(0)) {
            owner = newOwner;
        }
    }
}


contract TST20Basic {
  uint public totalSupply;
  function balanceOf(address who) public view returns (uint);
  function transfer(address to, uint value) public;
  event Transfer(address indexed from, address indexed to, uint value);
}

contract TST20 is TST20Basic {
  function allowance(address owner, address spender) public view returns (uint);
  function transferFrom(address from, address to, uint value) public;
  function approve(address spender, uint value) public;
  event Approval(address indexed owner, address indexed spender, uint value);
}


contract BasicLockedToken is TST20Basic,Ownable {
    
    using SafeMath for uint;
  
    mapping(address => uint) balances;
    
    struct LockedData {
        uint256 lockedTime;
        uint256 lockedValue;
    }
    
    mapping(address => LockedData) public lockedAccounts;
    bool public transferEnable = true;
    
    mapping(address  => bool) public admins;

    event AccountLocked(address indexed _address, uint256 _lockValue, uint256 _lockTime);
    
    modifier hasAdminRole() {
        require(isAdmin(msg.sender) || msg.sender == owner);
        _;
    }
    
    function transfer(address _to, uint _value) public{
        
        require(_value > 0 && _to != address(0));
        
        checkTransferAuth(msg.sender, _value);
        balances[msg.sender] = balances[msg.sender].sub(_value);
        balances[_to] = balances[_to].add(_value);
        Transfer(msg.sender, _to, _value);
    }

    function balanceOf(address _owner) public view returns (uint balance) {
        return balances[_owner];
    }
    
    function transferAndLock(address _to, uint256 _value) hasAdminRole public{
        
        require(_value > 0 && _to != address(0));

        LockedData storage account = lockedAccounts[_to];
        
        uint256 newLockValue = _value.mul(70).div(100); //lock 70%
        account.lockedValue = account.lockedValue.add(newLockValue);
        
        uint256 secondsPerDay = 86400;
        account.lockedTime = block.timestamp.add(secondsPerDay.mul(30)); //lock 30 days

        balances[msg.sender] = balances[msg.sender].sub(_value);
        balances[_to] = balances[_to].add(_value);
        Transfer(msg.sender, _to, _value);

        AccountLocked(_to, newLockValue, account.lockedTime);

    }
    
   
    function lock(address _to, uint256 _lockValue, uint256 _lockTime) onlyOwner public{

        require(_lockValue > 0 && _to != address(0));

        LockedData storage account = lockedAccounts[_to];
        account.lockedValue = _lockValue;
        account.lockedTime = _lockTime;
        AccountLocked(_to, _lockValue, _lockTime);
    }
    
    function unlock(address _to) onlyOwner public{

        require(_to != address(0));
        
        LockedData storage account = lockedAccounts[_to];
        account.lockedValue = 0;
        account.lockedTime = 0;
        AccountLocked(_to, 0, 0);
    }
    
    function lockedBalanceOf(address _owner) public view returns (uint256 balance) {
        return lockedAccounts[_owner].lockedValue;
    }
    
    function lockedTimeOf(address _owner) public view returns (uint256 lockedTime) {
        return lockedAccounts[_owner].lockedTime;
    }
    
    function isLocked(address _owner) public view returns (bool){
        LockedData storage account = lockedAccounts[_owner];
        return (account.lockedValue > 0) && (account.lockedTime > block.timestamp);
    }
    
    function checkTransferAuth(address _from, uint256 _transferValue) internal view{
        require(transferEnable);
        
        LockedData storage account = lockedAccounts[_from];
        require(account.lockedTime <= block.timestamp || balanceOf(_from).sub(account.lockedValue) >= _transferValue);
    }
    
    function changeTransferEnable(bool _transferEnable) onlyOwner public{
        transferEnable = _transferEnable;
    }
    
    function isAdmin(address _address) public view returns (bool) {
        return admins[_address];
    }
    
    function removeAdmin(address _address) onlyOwner public{
        admins[_address] = false;
    }
    
    function addAdmin(address _address) onlyOwner public {
        admins[_address] = true;
    }
    
}


contract StandardToken is BasicLockedToken, TST20 {
    mapping (address => mapping (address => uint)) allowed;

    function transferFrom(address _from, address _to, uint _value) public {
        require(_value > 0 && _to != address(0));
        checkTransferAuth(_from, _value);
        
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




contract CLAY is StandardToken {
    string public constant name = "CLAY";
    string public constant symbol = "CLAY";
    uint public constant decimals = 18;


    function CLAY() public {
        totalSupply = 2500000000*10**decimals;
        balances[msg.sender] = totalSupply; //Send all tokens to owner
    }


    function burn(uint _value) onlyOwner public returns (bool) {
        balances[msg.sender] = balances[msg.sender].sub(_value);
        totalSupply = totalSupply.sub(_value);
        Transfer(msg.sender, address(0), _value);
        return true;
    }
  
    //Transfer TTC or other token balance to owner
    function claimToken(address _tokenAddress) onlyOwner public {
        if(_tokenAddress == address(0)){
            require(owner.send(address(this).balance));
            return;
        }
        TST20 token = TST20(_tokenAddress);
        uint256 balance = token.balanceOf(this);
        token.transfer(owner, balance);
    }
    
    //Accept TTC transfer
    function() payable public{
    }

}