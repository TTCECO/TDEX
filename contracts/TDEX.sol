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
        
    uint constant public decimals = 18;
    uint constant public orderDecimals = 15; 
    uint constant public million = 10**6;
    
    uint public lastExecutionPrice = 0;                 // last execution price 
    uint public maxBuyPrice = 0;                        // buy token by TTC 
    uint public minSellPrice = 10**decimals;            // sell token 
    
    mapping(uint => uint[]) public buyTokenOrderMap;    // price => orderID []
    mapping(uint => uint[]) public sellTokenOrderMap;   // price => orderID []
    
    mapping(uint => uint) public buyStartPos;           // price => start index of buyTokenOrderMap
    mapping(uint => uint) public sellStartPos;          // price => start index of sellTokenOrderMap

    mapping(uint => uint) public buyAmountByPrice;      // price => amount
    mapping(uint => uint) public sellAmountByPrice;     // price => amount
    
    uint public orderID = 0; // auto increase 
    mapping(uint => Order) public allBuyOrder;          // orderID => Order  
    mapping(uint => Order) public allSellOrder;         // orderID => Order 

    uint public minOrderValue = 2*10**decimals;         // 2 TTC         
    uint public makerTxFeePerMillion = 3000;            // 3/1000
    uint public takerTxFeePerMillion = 1000;            // 1/1000   
    uint public maxPriceRange = 30;

    address public adminWithdrawAddress;
    
    
    event TE(uint t, address indexed addr, uint orderID, uint index, uint amount, uint price);
    // user operation
    // 1 - addBuyTokenOrder
    // 2 - addSellTokenOrder
    // 3 - exeBuyOrder
    // 4 - exeSellOrder 
    // 5 - cancelBuyOrder
    // 6 - cancelSellOrder
    // 7 - refundExtraTTC

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
    
    function setMaxPriceRange(uint _value) onlyOperator public {
        maxPriceRange = _value;   
    }

    /* set min token amount by admin */
    function setMinOrderValue(uint _value) onlyOperator public {
        minOrderValue = _value;
    } 
    
    /* set maker tx fee, order id is smaller */
    function setMakerTxFee(uint _fee) onlyOperator public {
        require(_fee < million.div(2));
        makerTxFeePerMillion = _fee;
    }

    /* set taker tx fee, order id is larger */
    function setTakerTxFee(uint _fee) onlyOperator public {
        require(_fee < million.div(2));
        takerTxFeePerMillion = _fee;
    }
    
    /* add buy order, amount(wei), price (wei/ttc) */     
    function addBuyTokenOrder(uint _amount,uint _price) public payable {
        require(_amount.mul(_price).div(10**decimals) >= minOrderValue);
        _price = _price.div(10**orderDecimals);
        require(lastExecutionPrice == 0 || lastExecutionPrice < maxPriceRange || _price > lastExecutionPrice - maxPriceRange );
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
        
        // update maxBuyPrice
        if (maxBuyPrice < _price) {
            maxBuyPrice = _price;
        }
        buyAmountByPrice[_price] = buyAmountByPrice[_price].add(_amount);
        TE(1, msg.sender, orderID,buyTokenOrderMap[_price].length -1 , _amount, _price.mul(10**orderDecimals));
     
    }
    
    /* add sell order, amount(wei), price (wei/ttc) */ 
    function addSellTokenOrder(uint _amount, uint _price) public {
        require(_amount.mul(_price).div(10**decimals) >= minOrderValue);
        _price = _price.div(10**orderDecimals);
        require(lastExecutionPrice == 0 || _price < lastExecutionPrice + maxPriceRange );
        MyToken.transferFrom(msg.sender, this, _amount);
        // orderID auto increase
        orderID += 1;
        allSellOrder[orderID] = Order({
          user:msg.sender,
          amount:_amount,
          price:_price
        });
        
        sellTokenOrderMap[_price].push(orderID);

        // udpate minSellPrice
        if (minSellPrice > _price) {
            minSellPrice = _price;
        }
        sellAmountByPrice[_price] = sellAmountByPrice[_price].add(_amount);
        TE(2, msg.sender, orderID,sellTokenOrderMap[_price].length -1 ,_amount, _price.mul(10**orderDecimals));
    }
    
    /* orders can execute exist */
    function existExecutionOrders() public view returns (bool) {
        if (minSellPrice <= maxBuyPrice) {
            return true;
        }else {
            return false;
        }
    }
    
    /* execute order */
    function executeOrder() public {
        if (minSellPrice > maxBuyPrice) { 
            return;
        }

        //  
        uint maxBuyIndex = buyStartPos[maxBuyPrice];
        uint buyOrderID = 0;
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
        if (buyOrderID == 0) {
            dealEmptyPrice(maxBuyPrice, true); 
            return;
        }
        uint buyPrice = allBuyOrder[buyOrderID].price;
        uint buyAmount = allBuyOrder[buyOrderID].amount;

        uint minSellIndex = sellStartPos[minSellPrice];
        uint sellOrderID = 0;
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
        if (sellOrderID == 0) {
            dealEmptyPrice(minSellPrice, false); 
            return;
        }
        uint sellPrice = allSellOrder[sellOrderID].price;
        uint sellAmount = allSellOrder[sellOrderID].amount;
        
        // set buyer & seller
        address buyer = allBuyOrder[buyOrderID].user;
        address seller = allSellOrder[sellOrderID].user;
        
        // get maker & taker
        if (buyOrderID > sellOrderID) {
            // seller is maker 
            TokenReceiverFee = takerTxFeePerMillion;
            TTCReceiverFee = makerTxFeePerMillion;
            lastExecutionPrice = sellPrice;
        }else {
            // buyer is maker 
            uint TokenReceiverFee = makerTxFeePerMillion;
            uint TTCReceiverFee = takerTxFeePerMillion;
            lastExecutionPrice = buyPrice;
        }
        
        // update data
        uint executeAmount = buyAmount; 
        if (buyAmount == sellAmount ) {
            delete allSellOrder[sellOrderID];
            delete allBuyOrder[buyOrderID];
            buyStartPos[buyPrice] += 1;
            sellStartPos[sellPrice] += 1;
        } else if (buyAmount > sellAmount){
            executeAmount = sellAmount;    
            allBuyOrder[buyOrderID].amount -= executeAmount;
            delete allSellOrder[sellOrderID];
            sellStartPos[sellPrice] += 1;
        } else {
            allSellOrder[sellOrderID].amount -= executeAmount;
            delete allBuyOrder[buyOrderID];
            buyStartPos[buyPrice] += 1;
        }
        buyAmountByPrice[buyPrice] = buyAmountByPrice[buyPrice].sub(executeAmount);
        sellAmountByPrice[sellPrice] = sellAmountByPrice[sellPrice].sub(executeAmount);
        
        // transfer      
        MyToken.transfer(buyer, executeAmount.mul(million.sub(TokenReceiverFee)).div(million));
        require(seller.send(executeAmount.mul(lastExecutionPrice).div(10**(decimals-orderDecimals)).mul(million.sub(TTCReceiverFee)).div(million)));
        
        // refund if needed
        if (buyOrderID > sellOrderID && buyPrice > lastExecutionPrice) {
            refundExtraTTC(buyer,executeAmount,buyPrice,lastExecutionPrice);
        }
        TE(3, buyer,buyOrderID, 0, executeAmount, lastExecutionPrice.mul(10**orderDecimals));
        TE(4, seller,sellOrderID, 0, executeAmount, lastExecutionPrice.mul(10**orderDecimals));
        
        // clear empty data
        dealEmptyPrice(buyPrice, true);
        dealEmptyPrice(sellPrice, false);
    }
    
    function refundExtraTTC(address _buyer, uint _amount, uint _buyPrice, uint _lastPrice) private {
        uint diffPrice = _buyPrice.sub(_lastPrice);
        require(_buyer.send(_amount.mul(diffPrice).div(10**(decimals-orderDecimals))));
        TE(7, _buyer,0,0, _amount, diffPrice.mul(10**orderDecimals));
    }

    function dealEmptyPrice(uint _price, bool _isBuyOrder ) public {
        if (_isBuyOrder) {
            if (buyStartPos[_price] == buyTokenOrderMap[_price].length) {
                delete buyStartPos[_price];
                delete buyTokenOrderMap[_price];
                for( i= maxBuyPrice;i >= 0 ; i--){
                    if (maxBuyPrice - i == maxPriceRange ) {
                        maxBuyPrice = i;
                        break;
                    }
                    if (i == 0) {
                        maxBuyPrice = 0;
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
                for(uint i= minSellPrice;i <= minSellPrice + maxPriceRange; i++){
                    if (minSellPrice == i - maxPriceRange) {
                        minSellPrice = i;
                        break;
                    }
                    if (sellTokenOrderMap[i].length > 0) {
                        minSellPrice = i;
                        break;
                    }
                }
            }
        }
    }


    function cancelBuyOrder(uint _orderID, uint _index) public {
        require(allBuyOrder[_orderID].user == msg.sender);
        uint buyPrice = allBuyOrder[_orderID].price;
        uint buyAmount = allBuyOrder[_orderID].amount;
        require(buyTokenOrderMap[buyPrice][_index] == _orderID && allBuyOrder[_orderID].amount > 0);
        allBuyOrder[_orderID].amount = 0 ; // for reentrancy
        
        uint value = buyAmount.mul(buyPrice).div(10**(decimals-orderDecimals));
        require(allBuyOrder[_orderID].user.send(value));
        buyTokenOrderMap[buyPrice][_index] = 0;
        if (_index == 0){
            buyStartPos[buyPrice] = 1;
        }else if (buyStartPos[buyPrice] == _index ) {
            buyStartPos[buyPrice] = _index + 1;
        }

        dealEmptyPrice(buyPrice, true);
        delete allBuyOrder[_orderID];
        
        TE(5, msg.sender,_orderID, _index, buyAmount, buyPrice.mul(10**orderDecimals));
        buyAmountByPrice[buyPrice] = buyAmountByPrice[buyPrice].sub(buyAmount);
    }
    
    function cancelSellOrder(uint _orderID, uint _index) public {
        require(allSellOrder[_orderID].user == msg.sender);
        uint sellPrice = allSellOrder[_orderID].price;
        uint sellAmount = allSellOrder[_orderID].amount;
        require(sellTokenOrderMap[sellPrice][_index] == _orderID && allSellOrder[_orderID].amount > 0);
        allSellOrder[_orderID].amount = 0; // for reentrancy
        
        MyToken.transfer(allSellOrder[_orderID].user, sellAmount);
        sellTokenOrderMap[sellPrice][_index] = 0;
        if (_index == 0){
            sellStartPos[sellPrice] = 1;
        }else if (sellStartPos[sellPrice] == _index ) {
            sellStartPos[sellPrice] = _index + 1;
        }

        dealEmptyPrice(sellPrice, false);
        delete allSellOrder[_orderID];
        
        TE(6, msg.sender,_orderID, _index, sellAmount, sellPrice.mul(10**orderDecimals));
        sellAmountByPrice[sellPrice] = sellAmountByPrice[sellPrice].sub(sellAmount);
    }
        
    function getOrderDetails(uint _orderID, bool _isBuyOrder) public view returns(address,uint,uint){
        if (_isBuyOrder){
            return (allBuyOrder[_orderID].user,allBuyOrder[_orderID].amount,allBuyOrder[_orderID].price);
        }else{
            return (allSellOrder[_orderID].user,allSellOrder[_orderID].amount,allSellOrder[_orderID].price);
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
