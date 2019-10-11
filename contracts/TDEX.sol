pragma solidity ^0.4.19;

import "./SafeMath.sol";
import "./TST20Interface.sol";
import "./PermissionGroups.sol";


contract TDEX is PermissionGroups {
    using SafeMath for uint;
    
    TST20 public MyToken;
    
    struct Order {
        address user;
        uint amount;
        uint price;
    }
    
    uint public lastExecutionPrice = 0; // last execution price 
    uint public maxBuyPrice = 0;    // buy token by TTC 
    uint public minSellPrice = 10**decimals;   // sell token 
    
    mapping(uint => uint[]) public buyTokenOrderMap;  // price => orderID []
    mapping(uint => uint[]) public sellTokenOrderMap; // price => orderID []
    
    mapping(uint => uint) public buyStartPos; // price => start index of buyTokenOrderMap
    mapping(uint => uint) public sellStartPos; // price => start index of sellTokenOrderMap
    
    uint public orderID = 0; // auto increase 
    mapping(uint => Order) public allBuyOrder;  // orderID => Order  
    mapping(uint => Order) public allSellOrder; // orderID => Order 
    
    uint constant public decimals = 18;
    uint constant public orderDecimals = 15; 
    uint constant public maxPriceRange = 30;
    
    // set token address 
    function setTokenAddress(address _addr) onlyAdmin public {
        require(_addr != address(0));
        MyToken = TST20(_addr); 
    }
    
    // return orderID     
    function addBuyTokenOrder(uint _amount,uint _price) public payable returns (uint){
        _price = _price.div(10**orderDecimals);
        require(maxBuyPrice == 0 || maxBuyPrice < maxPriceRange ||  _price > maxBuyPrice - maxPriceRange );
        // make sure got enough TTC 
        require(msg.value >= _amount.mul(_price).div(10**(decimals-orderDecimals))); // TTC value
        // orderID auto increase
        orderID += 1;
        // create order 
        allBuyOrder[orderID] = Order({
          user:msg.sender,
          amount:_amount,
          price:_price
        });
        
        buyTokenOrderMap[_price].push(orderID); 
        
        // check if line above this order 
        // check if there is sell order can be executed
        // update lastExecutionPrice
        // update maxBuyPrice
        if (maxBuyPrice < _price) {
            maxBuyPrice = _price;
        }
        return orderID;
    }
    
    // return orderID 
    function addSellTokenOrder(uint _amount, uint _price) public returns (uint) {
        _price = _price.div(10**orderDecimals);
        require(minSellPrice == 0 || _price < minSellPrice + maxPriceRange );
        MyToken.transferFrom(msg.sender, this, _amount);
        // orderID auto increase
        orderID += 1;
        allSellOrder[orderID] = Order({
          user:msg.sender,
          amount:_amount,
          price:_price
        });
        
        sellTokenOrderMap[_price].push(orderID);
        // check if line above this order 
        // check if there is fix buy order 
        // update lastExecutionPrice
        // udpate minSellPrice
        if (minSellPrice > _price) {
            minSellPrice = _price;
        }
        return orderID;
    }
    
    function existExecutionOrders() public view returns (bool) {
        if (minSellPrice <= maxBuyPrice) {
            return true;
        }else {
            return false;
        }
    }
    
    function executeOrder() public {
        if (minSellPrice > maxBuyPrice) { 
            return;
        }

        // deal  cancel orders 
        uint maxBuyIndex = buyStartPos[maxBuyPrice];
        uint buyOrderID = 0;
        uint buyPrice = maxBuyPrice;
        for (uint i = maxBuyIndex; i<maxBuyIndex + 10; i++) {
            buyStartPos[maxBuyPrice] = i;
            if (i >= buyTokenOrderMap[maxBuyPrice].length) {
                break;
            }
            if (buyTokenOrderMap[maxBuyPrice][i] == 0) {
                continue;
            }else {
                buyOrderID = buyTokenOrderMap[maxBuyPrice][i];
                break;
            }
        }

        // just one step each time;
        buyPrice = allBuyOrder[buyOrderID].price;
        uint buyAmount = allBuyOrder[buyOrderID].amount;
        

        uint minSellIndex = sellStartPos[minSellPrice];
        uint sellOrderID = 0;
        uint sellPrice = minSellPrice;
        for (i = minSellIndex; i<minSellIndex + 10; i++) {
            sellStartPos[minSellPrice] = i;
            if (i >= sellTokenOrderMap[minSellPrice].length) {
                break;
            }
            if (sellTokenOrderMap[minSellPrice][i] == 0) {
                continue;
            }else {
                sellOrderID = sellTokenOrderMap[minSellPrice][i];
                break;
            }
        }

        sellPrice = allSellOrder[sellOrderID].price;
        uint sellAmount = allSellOrder[sellOrderID].amount;
        
        if ( buyOrderID != 0 && sellOrderID != 0) {
            if (buyAmount == sellAmount ) {
        
                MyToken.transfer(allBuyOrder[buyOrderID].user, buyAmount);
                uint value = allSellOrder[sellOrderID].amount.mul(allSellOrder[sellOrderID].price).div(10**(decimals-orderDecimals));
                require(allSellOrder[sellOrderID].user.send(value));
                
                delete allSellOrder[sellOrderID];
                delete allBuyOrder[buyOrderID];
                buyStartPos[buyPrice] += 1;
                sellStartPos[sellPrice] += 1;
            } else if (buyAmount > sellAmount){
                MyToken.transfer(allBuyOrder[buyOrderID].user, sellAmount);
                value = sellAmount.mul(allSellOrder[sellOrderID].price).div(10**(decimals-orderDecimals));
                require(allSellOrder[sellOrderID].user.send(value));           
                
                allBuyOrder[buyOrderID].amount -= sellAmount;
                delete allSellOrder[sellOrderID];
                sellStartPos[sellPrice] += 1;
            } else {
                MyToken.transfer(allBuyOrder[buyOrderID].user, buyAmount);
                value = buyAmount.mul(allSellOrder[sellOrderID].price).div(10**(decimals-orderDecimals));
                require(allSellOrder[sellOrderID].user.send(value));
                
                allSellOrder[sellOrderID].amount -= buyAmount;
                delete allBuyOrder[buyOrderID];
                buyStartPos[buyPrice] += 1;
            }
            // update lastExecutionPrice 
            if (buyPrice == maxBuyPrice){
                lastExecutionPrice = buyPrice;
            }else {
                lastExecutionPrice = sellPrice;
            }

        }
        dealEmptyPrice(buyPrice, true);
        dealEmptyPrice(sellPrice, false);
    }

    function dealEmptyPrice(uint _price, bool _isBuyOrder ) public {
        if (_isBuyOrder) {
            if (buyStartPos[_price] == buyTokenOrderMap[_price].length) {
                delete buyStartPos[_price];
                delete buyTokenOrderMap[_price];
                
                for( i= maxBuyPrice;i>0 ; i--){
                    if (maxBuyPrice - maxPriceRange == i) {
                        break;
                    }
                    if (buyTokenOrderMap[i].length > 0) {
                        maxBuyPrice = i;
                        break;
                    }
                }
            }
        } else {
            if (sellStartPos[_price] == sellTokenOrderMap[_price].length) {
                delete sellStartPos[_price];
                delete sellTokenOrderMap[_price];
                for(uint i= minSellPrice;i<minSellPrice + maxPriceRange; i++){
                    if (sellTokenOrderMap[i].length > 0) {
                        minSellPrice = i;
                        break;
                    }
                }
            }
        }
    }

    /*
    function moveOrderList(uint _price) public {
        // move the list both buyTokenOrderMap and sellTokenOrderMap
        // if the price exist to move first n zeros.
        

    }
    */
    function cancelBuyOrder(uint _orderID, uint _index) public {
        require(allBuyOrder[_orderID].user == msg.sender);
        require(buyTokenOrderMap[allBuyOrder[_orderID].price][_index] == _orderID);
        
        uint value = allBuyOrder[_orderID].amount.mul(allBuyOrder[_orderID].price).div(10**(decimals-orderDecimals));
        require(allBuyOrder[_orderID].user.send(value));
        buyTokenOrderMap[allBuyOrder[_orderID].price][_index] = 0;
        if (_index == 0){
            buyStartPos[allBuyOrder[_orderID].price] = 1;
        }else if (buyStartPos[allBuyOrder[_orderID].price] == _index ) {
            buyStartPos[allBuyOrder[_orderID].price] = _index + 1;
        }

        dealEmptyPrice(allBuyOrder[_orderID].price, true);
        delete allBuyOrder[_orderID];

    }
    
    function cancelSellOrder(uint _orderID, uint _index) public {
        require(allSellOrder[_orderID].user == msg.sender);
        require(sellTokenOrderMap[allSellOrder[_orderID].price][_index] == _orderID);
        
        MyToken.transfer(allSellOrder[_orderID].user, allSellOrder[_orderID].amount);
        sellTokenOrderMap[allSellOrder[_orderID].price][_index] = 0;
        if (_index == 0){
            sellStartPos[allSellOrder[_orderID].price] = 1;
        }else if (sellStartPos[allSellOrder[_orderID].price] == _index ) {
            sellStartPos[allSellOrder[_orderID].price] = _index + 1;
        }

        dealEmptyPrice(allSellOrder[_orderID].price, false);
        delete allSellOrder[_orderID];
    }
        
    function getOrderDetails(uint _orderID, bool _isBuyOrder) public view returns(Order){
        if (_isBuyOrder){
            return allBuyOrder[_orderID];
        }else{
            return allSellOrder[_orderID];
        }
    }

    function getOrderPriceDetails(uint _price, uint _index, bool _isBuyOrder) public view returns(uint){
        if (_isBuyOrder ){
            if (_index < buyTokenOrderMap[_price].length) {
                    return buyTokenOrderMap[_price][_index];
                } else {
                    return 0;
                }
                
        } else {
            if (_index < sellTokenOrderMap[_price].length){
                    return sellTokenOrderMap[_price][_index];
                } else {
                    return 0;
                }
        }
    }
    
    function getOrderIndex(uint _price, bool _isBuyOrder, uint _targetOrderID, uint _start, uint _len) public view returns(uint){
        if (_isBuyOrder){
            for(uint i=_start; i < _start + _len ; i++){
                if (buyTokenOrderMap[_price][i] == _targetOrderID) {
                    return i;
                }
            }
        }else{
            for(i=_start; i < _start + _len ; i++){
                if (sellTokenOrderMap[_price][i] == _targetOrderID) {
                    return i;
                }
            }
        }
        // make sure to catch the error, error not equal zero
        require(false);
    }

    function getOrderLengthByPrice(uint _price, bool _isBuyOrder) public view returns(uint) {
        if (_isBuyOrder){
            return buyTokenOrderMap[_price].length; 
        }else{
            return sellTokenOrderMap[_price].length;
        }
        return 0;
    }
}
