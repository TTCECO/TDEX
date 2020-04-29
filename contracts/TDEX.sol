pragma solidity ^0.4.19;

import "./SafeMath.sol";
import "./TST20Interface.sol";
import "./PermissionGroups.sol";


contract TDEX is PermissionGroups {
    using SafeMath for uint;
    TST20 public MyToken;
    struct Order {
        address user;
        uint amount;                                    // (wei)
        uint price;                                     // (wei/10**orderDecimals)
        uint withhold;                                  // withhold tx fee for buy order only (wei)
    }
    uint constant public decimals = 18;
    uint constant public orderDecimals = 15;            // CUSD-17 CCNY-16 CKRW-14 ACN-14 CLAY-14
    uint constant public million = 10**6;

    uint public lastExecutionPrice = 0;                 // last execution price (wei/10**orderDecimals)
    uint public maxBuyPrice = 0;                        // buy token by TTC (wei/10**orderDecimals)
    uint public minSellPrice = 10**decimals;            // sell token (wei/10**orderDecimals)

    mapping(uint => uint[]) public buyTokenOrderMap;    // price(wei/10**orderDecimals) => orderID []
    mapping(uint => uint[]) public sellTokenOrderMap;   // price(wei/10**orderDecimals) => orderID []

    mapping(uint => uint) public buyStartPos;           // price(wei/10**orderDecimals) => start index of buyTokenOrderMap
    mapping(uint => uint) public sellStartPos;          // price(wei/10**orderDecimals) => start index of sellTokenOrderMap

    mapping(uint => uint) public buyAmountByPrice;      // price(wei/10**orderDecimals) => amount
    mapping(uint => uint) public sellAmountByPrice;     // price(wei/10**orderDecimals) => amount

    uint public orderID = 0; // auto increase
    mapping(uint => Order) public allBuyOrder;          // orderID => Order
    mapping(uint => Order) public allSellOrder;         // orderID => Order

    uint public minOrderValue = 2*10**decimals;         // 2 TTC
    uint public makerFeeRate = 0;		                //1000 is 1/1000     rate by million
    uint public takerFeeRate = 0;		                //3000 is 3/1000     rate by million
    uint public maxPriceRange = 300;

    address public adminWithdrawAddress;

    event TE(uint t, address indexed addr, uint orderID, uint index, uint amount, uint price, bool sign);
    // user operation
    // 1 - addBuyTokenOrder
    // 2 - addSellTokenOrder
    // 3 - exeBuyOrder      (sign == true if maker)
    // 4 - exeSellOrder     (sign == true if maker)
    // 5 - cancelBuyOrder   (sign == true if cancel by admin)
    // 6 - cancelSellOrder  (sign == true if cancel by admin)
    // 7 - refundBuyerExtraTTC
    // 8 - adminCollectTxFee

    /* init address */
    function initAddressSettings(uint _type,address _addr) public onlyAdmin {
        require(_addr != address(0));
        if (_type == 1) {
            adminWithdrawAddress = _addr;
        }else if (_type == 2 ) {
            MyToken = TST20(_addr);
        }
    }

    /* withdraw TTC by admin */
    function withdrawTTC() public onlyAdmin {
        require(adminWithdrawAddress != address(0));
        require(adminWithdrawAddress.send(this.balance));
    }

    /* withdraw Token by admin */
    function withdrawToken() public onlyAdmin{
        require(adminWithdrawAddress != address(0));
        MyToken.transfer(adminWithdrawAddress, MyToken.balanceOf(this));
    }

    /* set max price range */
    function setMaxPriceRange(uint _value) public onlyOperator {
        maxPriceRange = _value;
    }

    /* set min token amount by admin */
    function setMinOrderValue(uint _value) public onlyOperator {
        minOrderValue = _value;
    }

    /* set maker fee rate, order id is smaller */
    function setMakerFeeRate(uint _rate) public onlyOperator {
        require(_rate <= takerFeeRate);
        makerFeeRate = _rate;
    }

    /* set taker fee rate, order id is larger */
    function setTakerFeeRate(uint _rate) public onlyOperator {
        require(_rate < million.div(2) && _rate >= makerFeeRate);
        takerFeeRate = _rate;
    }

    /* add buy order, price (wei/ttc) */
    function addBuyTokenOrder(uint _price) public payable {
        require(msg.value >= minOrderValue);
        // use taker fee as withhold, because taker fee >= maker fee
        uint withhold = msg.value.mul(takerFeeRate).div(million);
        // calculate _amount by (msg.value - withhold)/ _price
        uint _amount = msg.value.sub(withhold).mul(10**decimals).div(_price);
        _price = _price.div(10**orderDecimals);
        if (lastExecutionPrice != 0) {
            require(_price < lastExecutionPrice.add(maxPriceRange));
            if (lastExecutionPrice > maxPriceRange){
                require(_price > lastExecutionPrice.sub(maxPriceRange));
            }
        }

        // orderID auto increase
        orderID += 1;
        // create order
        allBuyOrder[orderID] = Order({
          user:msg.sender,
          amount:_amount,
          price:_price,
          withhold: withhold
        });

        buyTokenOrderMap[_price].push(orderID);

        // update maxBuyPrice
        if (maxBuyPrice < _price) {
            maxBuyPrice = _price;
        }
        buyAmountByPrice[_price] = buyAmountByPrice[_price].add(_amount);
        TE(1, msg.sender, orderID,buyTokenOrderMap[_price].length - 1, _amount, _price.mul(10**orderDecimals),false);

    }

    /* add sell order, amount(wei), price (wei/ttc) */
    function addSellTokenOrder(uint _amount, uint _price) public {
        require(_amount.mul(_price).div(10**decimals) >= minOrderValue);
        _price = _price.div(10**orderDecimals);
        if (lastExecutionPrice!=0){
            require(_price < lastExecutionPrice.add(maxPriceRange));
            if (lastExecutionPrice > maxPriceRange) {
                require(_price > lastExecutionPrice.sub(maxPriceRange));
            }
        }

        MyToken.transferFrom(msg.sender, this, _amount);
        // orderID auto increase
        orderID += 1;
        allSellOrder[orderID] = Order({
          user:msg.sender,
          amount:_amount,
          price:_price,
          withhold: 0
        });

        sellTokenOrderMap[_price].push(orderID);

        // udpate minSellPrice
        if (minSellPrice > _price) {
            minSellPrice = _price;
        }
        sellAmountByPrice[_price] = sellAmountByPrice[_price].add(_amount);
        TE(2, msg.sender, orderID,sellTokenOrderMap[_price].length - 1, _amount, _price.mul(10**orderDecimals),false);
    }

    /* orders can execute exist */
    function existExecutionOrders() public view returns (bool) {
        if (minSellPrice <= maxBuyPrice) {
            return true;
        }else {
            return false;
        }
    }

    /* query first sell order ID on min sell price, return 0 if order ID can not be found */
    function querySellOrderID() internal returns (uint){
        uint minSellIndex = sellStartPos[minSellPrice];
        uint sellOrderID = 0;
        for (uint i = minSellIndex; i<minSellIndex + 10; i++) {
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
        return sellOrderID;
    }

    /* query first buy order ID on max buy price, return 0 if order ID can not be found */
    function queryBuyOrderID() internal returns (uint) {
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
        return buyOrderID;
    }

    /* execute order */
    function executeOrder() public {
        if (minSellPrice > maxBuyPrice) {
            return;
        }

        uint buyOrderID = queryBuyOrderID();
        if (buyOrderID == 0) {
            dealEmptyPrice(maxBuyPrice.mul(10**orderDecimals), true);
            return;
        }
        uint buyPrice = allBuyOrder[buyOrderID].price;
        uint buyAmount = allBuyOrder[buyOrderID].amount;
        uint buyWithhold = 0;

        uint sellOrderID = querySellOrderID();
        if (sellOrderID == 0) {
            dealEmptyPrice(minSellPrice.mul(10**orderDecimals), false);
            return;
        }
        uint sellPrice = allSellOrder[sellOrderID].price;
        uint sellAmount = allSellOrder[sellOrderID].amount;

        // set buyer & seller
        address buyer = allBuyOrder[buyOrderID].user;
        address seller = allSellOrder[sellOrderID].user;

        uint tokenReceiverFeeRate;
        uint ttcReceiverFeeRate;
        // get maker & taker
        if (buyOrderID > sellOrderID) {
            // seller is maker
            tokenReceiverFeeRate = takerFeeRate;
            ttcReceiverFeeRate = makerFeeRate;
            lastExecutionPrice = sellPrice;
        }else {
            // buyer is maker
            tokenReceiverFeeRate = makerFeeRate;
            ttcReceiverFeeRate = takerFeeRate;
            lastExecutionPrice = buyPrice;
        }

        // update data
        uint executeAmount = buyAmount;
        if (buyAmount == sellAmount ) {
            buyWithhold = allBuyOrder[buyOrderID].withhold;
            delete allSellOrder[sellOrderID];
            delete allBuyOrder[buyOrderID];
            buyStartPos[buyPrice] += 1;
            sellStartPos[sellPrice] += 1;
        } else if (buyAmount > sellAmount){
            executeAmount = sellAmount;
            buyWithhold = popBuyWithhold(buyOrderID,executeAmount,lastExecutionPrice, tokenReceiverFeeRate);
            allBuyOrder[buyOrderID].amount -= executeAmount;
            delete allSellOrder[sellOrderID];
            sellStartPos[sellPrice] += 1;
        } else {
            allSellOrder[sellOrderID].amount -= executeAmount;
            buyWithhold = allBuyOrder[buyOrderID].withhold;
            delete allBuyOrder[buyOrderID];
            buyStartPos[buyPrice] += 1;
        }
        buyAmountByPrice[buyPrice] = buyAmountByPrice[buyPrice].sub(executeAmount);
        sellAmountByPrice[sellPrice] = sellAmountByPrice[sellPrice].sub(executeAmount);

        // transfer
        MyToken.transfer(buyer, executeAmount);
        require(seller.send(executeAmount.mul(lastExecutionPrice).div(10**(decimals-orderDecimals)).mul(million.sub(ttcReceiverFeeRate)).div(million)));

        uint exWithhold = calculateExWithhold(executeAmount,lastExecutionPrice,tokenReceiverFeeRate,buyWithhold);
        refundBuyerExtraTTC(buyer,executeAmount,buyPrice,lastExecutionPrice,exWithhold);
        if (buyOrderID < sellOrderID) {
            TE(3, buyer,buyOrderID, 0, executeAmount, lastExecutionPrice.mul(10**orderDecimals), true);
            TE(4, seller,sellOrderID, 0, executeAmount, lastExecutionPrice.mul(10**orderDecimals), false);
        }else {
            TE(3, buyer,buyOrderID, 0, executeAmount, lastExecutionPrice.mul(10**orderDecimals), false);
            TE(4, seller,sellOrderID, 0, executeAmount, lastExecutionPrice.mul(10**orderDecimals), true);
        }
        //
        collectTradeFee(executeAmount, lastExecutionPrice,ttcReceiverFeeRate, buyWithhold, exWithhold);
        // clear empty data
        dealEmptyPrice(buyPrice.mul(10**orderDecimals), true);
        dealEmptyPrice(sellPrice.mul(10**orderDecimals), false);
    }

    /* collect trade fee to adminWithdrawAddress */
    function collectTradeFee(uint _amount,uint _lastPrice, uint _ttcReceiverFeeRate, uint _withhold, uint _exWithhold) internal {
        require(adminWithdrawAddress != address(0));

        uint tradeFee = _amount.mul(_lastPrice).div(10**(decimals-orderDecimals)).mul(_ttcReceiverFeeRate).div(million);
        if (_withhold > 0 && _withhold > _exWithhold) {
            tradeFee = tradeFee.add(_withhold).sub(_exWithhold);
        }
        if (tradeFee > 0){
            require(adminWithdrawAddress.send(tradeFee));
            TE(8, adminWithdrawAddress, 0, 0, _amount, tradeFee.mul(10**decimals).div(_amount),false);
        }
    }

    /* return the withhold for this tx and update the withhold of order */
    function popBuyWithhold(uint _buyOrderID,uint _amount,uint _lastPrice, uint _tokenReceiverFeeRate) internal returns (uint) {
        uint buyWithhold = _amount.mul(_lastPrice).div(10**(decimals-orderDecimals)).mul(_tokenReceiverFeeRate).div(million);
        if (buyWithhold > allBuyOrder[_buyOrderID].withhold) {
            buyWithhold = allBuyOrder[_buyOrderID].withhold;
        }
        allBuyOrder[_buyOrderID].withhold = allBuyOrder[_buyOrderID].withhold.sub(buyWithhold);
        return buyWithhold;
    }

    /* return the exwithhold value of this tx, when the buy order execute as taker at first , and as maker full fill order, then ... */
    function calculateExWithhold(uint _amount, uint _lastPrice, uint _tokenReceiverFeeRate, uint _withhold) internal pure returns (uint) {
        uint exWithhold = 0;
        uint buyTradeFee = _amount.mul(_lastPrice).div(10**(decimals-orderDecimals)).mul(_tokenReceiverFeeRate).div(million);
        if (buyTradeFee < _withhold) {
            exWithhold = _withhold.sub(buyTradeFee);
        }

        return exWithhold;
    }

    /* refund ttc to buyer, (diff price)*amount + exwithhold */
    function refundBuyerExtraTTC(address _buyer, uint _amount, uint _buyPrice, uint _lastPrice, uint _exWithhold) internal {
        uint refund = 0;
        if (_buyPrice > _lastPrice){
            uint diffPrice = _buyPrice.sub(_lastPrice);
            refund = _amount.mul(diffPrice).div(10**(decimals-orderDecimals));
        }
        if (_exWithhold > 0){
            refund = refund.add(_exWithhold);
        }
        if (refund > 0) {
            require(_buyer.send(refund));
            TE(7, _buyer,0,0, _amount, refund.mul(10**decimals).div(_amount),false);
        }
    }

    /* deal empty price */
    function dealEmptyPrice(uint _price, bool _isBuyOrder ) public {
        _price = _price.div(10**orderDecimals);
        if (_isBuyOrder) {
            if (buyStartPos[_price] == buyTokenOrderMap[_price].length) {
                delete buyStartPos[_price];
                delete buyTokenOrderMap[_price];
                for( i = maxBuyPrice;i >= 0 ; i-- ){
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
                for(uint i = minSellPrice;i <= minSellPrice.add(maxPriceRange); i++){
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

    /* admin cancel buy/sell order */
    function adminCancelOrder(bool _buy, uint _orderID, uint _index) public onlyAdmin{
        if (_buy == true)  {
            cancelBuy(_orderID, _index, true);
        }else {
            cancelSell(_orderID, _index, true);
        }
    }

    /* user cancel self buy order */
    function cancelBuyOrder(uint _orderID, uint _index) public {
        require(allBuyOrder[_orderID].user == msg.sender);
        cancelBuy(_orderID, _index, false);
    }

    /* cancel buy order */
    function cancelBuy(uint _orderID, uint _index, bool _admin) internal {
        address orderOwner = allBuyOrder[_orderID].user;
        uint buyPrice = allBuyOrder[_orderID].price;
        uint buyAmount = allBuyOrder[_orderID].amount;
        require(buyTokenOrderMap[buyPrice][_index] == _orderID && allBuyOrder[_orderID].amount > 0);

        uint value = buyAmount.mul(buyPrice).div(10**(decimals-orderDecimals)).add(allBuyOrder[_orderID].withhold);
        allBuyOrder[_orderID].amount = 0; // for reentrancy
        allBuyOrder[_orderID].withhold = 0; // for reentrancy

        require(allBuyOrder[_orderID].user.send(value));
        buyTokenOrderMap[buyPrice][_index] = 0;
        if (_index == 0){
            buyStartPos[buyPrice] = 1;
        }else if (buyStartPos[buyPrice] == _index ) {
            buyStartPos[buyPrice] = _index + 1;
        }

        dealEmptyPrice(buyPrice.mul(10**orderDecimals), true);
        delete allBuyOrder[_orderID];

        TE(5, orderOwner ,_orderID, _index, buyAmount, buyPrice.mul(10**orderDecimals),_admin);
        buyAmountByPrice[buyPrice] = buyAmountByPrice[buyPrice].sub(buyAmount);
    }

    /* user cancel self sell order */
    function cancelSellOrder(uint _orderID, uint _index) public {
        require(allSellOrder[_orderID].user == msg.sender);
        cancelSell( _orderID, _index, false);
    }

    /* cancel sell order */
    function cancelSell(uint _orderID, uint _index, bool _admin) internal {
        address orderOwner = allSellOrder[_orderID].user;
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

        dealEmptyPrice(sellPrice.mul(10**orderDecimals), false);
        delete allSellOrder[_orderID];

        TE(6, orderOwner,_orderID, _index, sellAmount, sellPrice.mul(10**orderDecimals), _admin);
        sellAmountByPrice[sellPrice] = sellAmountByPrice[sellPrice].sub(sellAmount);
    }

    /* get detail of order */
    function getOrderDetails(uint _orderID, bool _isBuyOrder) public view returns(address,uint,uint,uint){
        if (_isBuyOrder){
            return (allBuyOrder[_orderID].user,allBuyOrder[_orderID].amount,allBuyOrder[_orderID].price.mul(10**orderDecimals),allBuyOrder[_orderID].withhold);
        }else{
            return (allSellOrder[_orderID].user,allSellOrder[_orderID].amount,allSellOrder[_orderID].price.mul(10**orderDecimals),allSellOrder[_orderID].withhold);
        }
    }

    /* get order index by price, return 0 if order ID can not be found */
    function getOrderPriceDetails(uint _price, uint _index, bool _isBuyOrder) public view returns(uint) {
        _price = _price.div(10**orderDecimals);
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

    /* get order index by price and order id */
    function getOrderIndex(uint _price, bool _isBuyOrder, uint _targetOrderID, uint _start, uint _len) public view returns(uint){
        _price = _price.div(10**orderDecimals);
        if (_isBuyOrder){
            for(uint i = _start; i < _start + _len ;i++){
                if (buyTokenOrderMap[_price][i] == _targetOrderID) {
                    return i;
                }
            }
        }else{
            for(i = _start; i < _start + _len ; i++){
                if (sellTokenOrderMap[_price][i] == _targetOrderID) {
                    return i;
                }
            }
        }
        // make sure to catch the error, error not equal zero
        require(false);
    }

    /* get order length by price and order type */
    function getOrderLengthByPrice(uint _price, bool _isBuyOrder) public view returns(uint) {
        _price = _price.div(10**orderDecimals);
        if (_isBuyOrder){
            return buyTokenOrderMap[_price].length;
        }else{
            return sellTokenOrderMap[_price].length;
        }
        return 0;
    }
}

