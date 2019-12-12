pragma solidity ^0.4.19;

import "./SafeMath.sol";
import "./TST20Interface.sol";
import "./PermissionGroups.sol";


contract TransToken is PermissionGroups {
    using SafeMath for uint;
    TST20 public MyToken;
    uint constant public decimals = 18;
    uint public minTransValue = 1*10**decimals;         // 1  Token         
    uint public transFee = 20*10**decimals;              // 20 Token
    address public adminWithdrawAddress;
    
    event TT(uint t, address indexed addrFrom,address addrTo, uint amount, uint fee);
    // user operation
    // 1 - transfer token 

    /* init address */
    function initAddressSettings(uint _type,address _addr) onlyAdmin public {
        require(_addr != address(0));
        if (_type == 1) {
            adminWithdrawAddress = _addr;       
        }else if (_type == 2 ) {
            MyToken = TST20(_addr); 
        }  
    }

    /* withdraw TTC by admin */
    function withdrawTTC() onlyAdmin public {
        require(adminWithdrawAddress.send(this.balance));
    }
    
    /* withdraw Token by admin */
    function withdrawToken() onlyAdmin public {
        MyToken.transfer(adminWithdrawAddress, MyToken.balanceOf(this));
    }
    
    function setMinTransValue(uint _value) onlyAdmin public {
        minTransValue = _value;   
    }

    function setTransFee(uint _value) onlyAdmin public {
        transFee = _value;
    }

    /* add sell order, amount(wei) */ 
    function transferToken(address _target,uint _amount) public {
        require(_amount >= minTransValue);
        require(_target != address(0));
        require(MyToken.balanceOf(msg.sender) >= _amount.add(transFee));
        MyToken.transferFrom(msg.sender, _target, _amount);
        MyToken.transferFrom(msg.sender, this, transFee);
        TT(1, msg.sender, _target,_amount,transFee);
    }
}
