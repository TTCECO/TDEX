var TDEX = artifacts.require("./TDEX.sol");
var TOKEN;
var targetToken = 'CLAY';
if (targetToken == 'CLAY') {
    TOKEN = artifacts.require("./CLAY.sol");
}else if (targetToken == 'CFIAT') {
    TOKEN = artifacts.require("./CFIAT.sol");
}

contract('TDEX', function() {
    var eth = web3.eth;
    var owner = eth.accounts[0];
    var user1 = eth.accounts[1];

    var decimal = new web3.BigNumber('1000000000000000000');  // 10**18
    var order_decimal = new web3.BigNumber('1000000000000000'); // 10**15


    var user1DepositTTCNum = decimal.mul(2);   // TTC Amount
    var user1BuyNum = decimal.mul(200);        // Token Amount
    var user1Price = decimal.mul(0.01).floor();

    var user2 = eth.accounts[2];
    var user2DepositTTCNum = decimal.mul(2.2).floor(); 
    var user2BuyNum = decimal.mul(200); 
    var user2Price = decimal.mul(0.011).floor();

    var user3 = eth.accounts[3];
    var user3SellNum = decimal.mul(300);
    var user3Price = decimal.mul(0.011).floor();

    var user4 = eth.accounts[4];
    var user4SellNum = decimal.mul(300);
    var user4Price = decimal.mul(0.01).floor();

    var executer = eth.accounts[5];

    var user6 = eth.accounts[6];
    var user6DepositTTCNum = decimal.mul(2.7).floor();
    var user6BuyNum = decimal.mul(300);
    var user6Price = decimal.mul(0.009).floor();

    var user7 = eth.accounts[7];
    var user7DepositTTCNum = decimal.mul(2.8).floor();
    var user7BuyNum = decimal.mul(200);
    var user7Price = decimal.mul(0.014).floor();


	function getBalance(addr){
        return web3.fromWei(web3.eth.getBalance(addr), "ether");
	}

	function printBalance() {
        const ownerBalance = web3.eth.getBalance(owner);
        console.log("Owner balance", web3.fromWei(ownerBalance, "ether").toString(), " ETHER");

        const user1Balance = web3.eth.getBalance(user1);
        console.log("user1 balance", web3.fromWei(user1Balance, "ether").toString(), " ETHER");
  	
    }

  	it("start ",function(){
    	return TDEX.deployed().then(function(content){
      		printBalance();
    	});
  	});

    it("add token for tdex",  async () =>  {
        const tdex = await TDEX.deployed();
        const token = await TOKEN.deployed();
        await tdex.setTokenAddress(token.address, {from:owner});
        token_address = await tdex.MyToken.call();
        assert.equal(token_address, token.address, "equal");
        await tdex.addOperator(owner,{from:owner});
    });


    it("user1 buy token",  async () =>  {
        const tdex = await TDEX.deployed();
        await tdex.addBuyTokenOrder(user1BuyNum, user1Price,{from:user1, to:tdex.address, value:user1DepositTTCNum});

        max_buy_price = await tdex.maxBuyPrice.call();
        assert.equal(max_buy_price, user1Price/order_decimal, "equal");

        order = await tdex.allBuyOrder.call(1);
        assert.equal(order[1].toString(10), user1BuyNum.toString(10), "equal");
        assert.equal(order[2].toString(10), user1Price.div(order_decimal).toString(10), "equal");
    });

    it("try add buy order less than min token amount ",async () => {    
        const tdex = await TDEX.deployed();
        tdex.setMinTokenAmount(user2BuyNum * 2, {from:owner});
        var gotErr = false;
        await tdex.addBuyTokenOrder(user2BuyNum, user2Price,{from:user2, to:tdex.address, value:user2DepositTTCNum}).catch(function(error) {
            gotErr = true;
            assert(error.toString().includes('Error: VM Exception while processing transaction: revert'), error.toString())
            
        });
        assert.equal(gotErr, true, "equal");
        await tdex.setMinTokenAmount(100*10**18, {from:owner});
    });

    it("user2 buy token",  async () =>  {
        const tdex = await TDEX.deployed();
        await tdex.addBuyTokenOrder(user2BuyNum, user2Price,{from:user2, to:tdex.address, value:user2DepositTTCNum});

        max_buy_price = await tdex.maxBuyPrice.call();
        assert.equal(max_buy_price, user2Price/order_decimal, "equal");

        order = await tdex.allBuyOrder.call(2);
        assert.equal(order[1].toString(10), user2BuyNum.toString(10), "equal");
        assert.equal(order[2].toString(10), user2Price.div(order_decimal).toString(10), "equal");
    });


    it("transfer token to user3 and user4",  async () =>  {
        //const tdex = await TDEX.deployed();
        const token = await TOKEN.deployed();
        const tdex = await TDEX.deployed();

        if (targetToken == 'CFIAT') {
                await token.addOperator(owner,{from:owner});
                await token.create(owner,25*10**26,{from:owner});
        }

        await token.transfer(user3,user3SellNum*20, {from:owner});
        await token.transfer(user4,user4SellNum*20, {from:owner});
        
        user3_token_balance = await token.balanceOf.call(user3);
        assert.equal(user3_token_balance.toString(10), user3SellNum.mul(20).toString(10), "equal");

        user4_token_balance = await token.balanceOf.call(user4);
        assert.equal(user4_token_balance.toString(10), user4SellNum.mul(20).toString(10), "equal");


        await token.approve(tdex.address,user3SellNum*20, {from:user3});
        await token.approve(tdex.address,user4SellNum*20, {from:user4});
        
    });


    it("user3 sell token",  async () =>  {
        const tdex = await TDEX.deployed();
        const token = await TOKEN.deployed();

        // transfer token to user3 and user4
        await tdex.addSellTokenOrder(user3SellNum, user3Price,{from:user3});

        min_sell_price = await tdex.minSellPrice.call();
        assert.equal(min_sell_price, user3Price/order_decimal, "equal");

        order = await tdex.allSellOrder.call(3);
        assert.equal(order[1].toString(10), user3SellNum.toString(10), "equal");
        assert.equal(order[2].toString(10), user3Price.div(order_decimal).toString(10), "equal");

        user3_token_balance = await token.balanceOf.call(user3);
        assert.equal(user3_token_balance.toString(10), user3SellNum*20-user3SellNum.toString(10), "equal");
        
    });


    it("user4 sell token",  async () =>  {
        const tdex = await TDEX.deployed();

        // transfer token to user3 and user4
        await tdex.addSellTokenOrder(user4SellNum, user4Price,{from:user4});

        min_sell_price = await tdex.minSellPrice.call();
        assert.equal(min_sell_price.toString(10), user4Price.div(order_decimal).toString(10), "equal");

        order = await tdex.allSellOrder.call(4);

        assert.equal(order[1].toString(10), user4SellNum.toString(10), "equal");
        assert.equal(order[2].toString(10), user4Price.div(order_decimal).toString(10), "equal");
    });


    it("user6 buy token",  async () =>  {
        const tdex = await TDEX.deployed();
        await tdex.addBuyTokenOrder(user6BuyNum, user6Price,{from:user6, to:tdex.address, value:user6DepositTTCNum});

        max_buy_price = await tdex.maxBuyPrice.call();
        assert.equal(max_buy_price.toString(10), user2Price.div(order_decimal).toString(10), "equal");

        order = await tdex.allBuyOrder.call(5);
        assert.equal(order[1].toString(10), user6BuyNum.toString(10), "equal");
        assert.equal(order[2].toString(10), user6Price.div(order_decimal).toString(10),"equal");

    });


    it("executer execute order",  async () =>  {

        const tdex = await TDEX.deployed();
        const token = await TOKEN.deployed();

        last_execute_price = await tdex.lastExecutionPrice.call();
        //console.log("before trade last_execute_price", last_execute_price);

        price1_orders = await tdex.getOrderPriceDetails.call(10, 0, true);
        price2_orders = await tdex.getOrderPriceDetails.call(11, 0, true);
        price3_orders = await tdex.getOrderPriceDetails.call(11, 0, false);
        price4_orders = await tdex.getOrderPriceDetails.call(10, 0, false);
        
        //console.log("xxx", price1_orders, price2_orders, price3_orders, price4_orders);

        max_buy_price = await tdex.maxBuyPrice.call();
        assert.equal(max_buy_price.toString(10), user2Price.div(order_decimal).toString(10), "equal");

        min_sell_price = await tdex.minSellPrice.call();
        assert.equal(min_sell_price.toString(10), user4Price.div(order_decimal).toString(10), "equal");


        maker_tx_fee_per_million = await tdex.makerTxFeePerMillion.call();
        taker_tx_fee_per_million = await tdex.takerTxFeePerMillion.call();
        million = await tdex.million.call();
        user4_ttc_before = await web3.eth.getBalance(user4);
        user2_token_before = await token.balanceOf.call(user2);
        // transfer token from user4 to user2
        await tdex.executeOrder({from:executer});
        user4_ttc_after = await web3.eth.getBalance(user4);
        user2_token_after = await token.balanceOf.call(user2);


        min_sell_price = await tdex.minSellPrice.call();
        assert.equal(min_sell_price.toString(10), user4Price.div(order_decimal).toString(10), "equal");

        max_buy_price = await tdex.maxBuyPrice.call();
        assert.equal(max_buy_price.toString(10), user1Price.div(order_decimal).toString(10), "equal");

        price1_orders = await tdex.getOrderPriceDetails.call(10, 0, true);
        price2_orders = await tdex.getOrderPriceDetails.call(11, 0, true);
        price3_orders = await tdex.getOrderPriceDetails.call(11, 0, false);
        price4_orders = await tdex.getOrderPriceDetails.call(10, 0, false);
        
        //console.log("yyy", price1_orders, price2_orders, price3_orders, price4_orders);

        last_execute_price = await tdex.lastExecutionPrice.call();
        //console.log("after trade last_execute_price", last_execute_price); 

        assert.equal(user2BuyNum.mul(million.sub(maker_tx_fee_per_million)).div(million).toString(10),
            user2_token_after.sub(user2_token_before).toString(10),
            "equal");
        assert.equal(user2BuyNum.mul(last_execute_price).mul(million.sub(taker_tx_fee_per_million)).div(million).div(decimal).toString(10) ,
            user4_ttc_after.sub(user4_ttc_before).div(order_decimal).toString(10),"equal");

    });


    it("executer execute order again",  async () =>  {

        const tdex = await TDEX.deployed();
        const token = await TOKEN.deployed();

        last_execute_price = await tdex.lastExecutionPrice.call();
        //console.log("before trade last_execute_price", last_execute_price);
        
        price1_orders = await tdex.getOrderPriceDetails.call(10, 0, true);
        price2_orders = await tdex.getOrderPriceDetails.call(11, 0, true);
        price3_orders = await tdex.getOrderPriceDetails.call(11, 0, false);
        price4_orders = await tdex.getOrderPriceDetails.call(10, 0, false);
        
        //console.log("xxx", price1_orders, price2_orders, price3_orders, price4_orders);

        maker_tx_fee_per_million = await tdex.makerTxFeePerMillion.call();
        taker_tx_fee_per_million = await tdex.takerTxFeePerMillion.call();
        million = await tdex.million.call();
        user4_ttc_before = await web3.eth.getBalance(user4);
        user1_token_before = await token.balanceOf.call(user1);
        await tdex.executeOrder({from:executer});
        user4_ttc_after = await web3.eth.getBalance(user4);
        user1_token_after = await token.balanceOf.call(user1);


        min_sell_price = await tdex.minSellPrice.call();
        assert.equal(min_sell_price.toString(10), user3Price.div(order_decimal).toString(10), "equal");
        max_buy_price = await tdex.maxBuyPrice.call();
        assert.equal(max_buy_price.toString(10), user1Price.div(order_decimal).toString(10), "equal");

        price1_orders = await tdex.getOrderPriceDetails.call(10, 0, true);
        price2_orders = await tdex.getOrderPriceDetails.call(11, 0, true);
        price3_orders = await tdex.getOrderPriceDetails.call(11, 0, false);
        price4_orders = await tdex.getOrderPriceDetails.call(10, 0, false);
        
        //console.log("yyy", price1_orders, price2_orders, price3_orders, price4_orders);

        last_execute_price = await tdex.lastExecutionPrice.call();
        //console.log("after trade last_execute_price", last_execute_price);

        assert.equal(user4SellNum.sub(user2BuyNum).mul(million.sub(maker_tx_fee_per_million)).div(million).toString(10),
            user1_token_after.sub(user1_token_before).toString(10),"equal");

        assert.equal(user4SellNum.sub(user2BuyNum).mul(last_execute_price).mul(million.sub(taker_tx_fee_per_million)).div(million).div(decimal).toString(10),
            user4_ttc_after.sub(user4_ttc_before).div(order_decimal).toString(10),"equal");
    });


    it("user1 cancel order",  async () =>  {
        const tdex = await TDEX.deployed();

        // transfer token to user3 and user4
        order_index = await tdex.getOrderIndex(user1Price/order_decimal, true, 1, 0, 10);
        assert.equal(order_index, 0)

        await tdex.cancelBuyOrder(1, order_index, {from:user1});

        max_buy_price = await tdex.maxBuyPrice.call();
        assert.equal(max_buy_price.toString(10), user6Price.div(order_decimal).toString(10),"equal");

        order = await tdex.allBuyOrder.call(1);
        assert.equal(order[1], 0, "equal");
        assert.equal(order[2], 0, "equal");
        
    });

    it("user3 cancel order",  async () =>  {
        const tdex = await TDEX.deployed();
        const token = await TOKEN.deployed();

        // transfer token to user3 and user4
        order_index = await tdex.getOrderIndex(user3Price/order_decimal, false, 3, 0, 10);
        assert.equal(order_index, 0)

        await tdex.cancelSellOrder(3, order_index, {from:user3});

        min_sell_price = await tdex.minSellPrice.call();
        assert.equal(min_sell_price, user3Price/order_decimal, "equal");

        order = await tdex.allBuyOrder.call(3);
        assert.equal(order[1], 0, "equal");
        assert.equal(order[2], 0, "equal");

        user3_token_balance = await token.balanceOf.call(user3);
        assert.equal(user3_token_balance, user3SellNum*20, "equal");
        
    });


    it("user3 sell token",  async () =>  {
        const tdex = await TDEX.deployed();
        const token = await TOKEN.deployed();

        // transfer token to user3 and user4
        await tdex.addSellTokenOrder(user3SellNum, user3Price,{from:user3});

        min_sell_price = await tdex.minSellPrice.call();
        assert.equal(min_sell_price, user3Price/order_decimal, "equal");

        order = await tdex.allSellOrder.call(6);
        assert.equal(order[1].toString(10), user3SellNum.toString(10), "equal");
        assert.equal(order[2].toString(10), user3Price.div(order_decimal).toString(10), "equal");

        user3_token_balance = await token.balanceOf.call(user3);
        assert.equal(user3_token_balance.toString(10), user3SellNum.mul(20).sub(user3SellNum).toString(10), "equal");
        
    });

    it("user7 buy token",  async () =>  {
        const tdex = await TDEX.deployed();
        await tdex.addBuyTokenOrder(user2BuyNum, user7Price,{from:user7, to:tdex.address, value:user7DepositTTCNum});

        max_buy_price = await tdex.maxBuyPrice.call();
        assert.equal(max_buy_price.toString(10), user7Price.div(order_decimal).toString(10), "equal");

        order = await tdex.allBuyOrder.call(7);
        assert.equal(order[1].toString(10), user7BuyNum.toString(10), "equal");
        assert.equal(order[2].toString(10), user7Price.div(order_decimal).toString(10), "equal");
    });

    it("executer execute order after someone cancel",  async () =>  {

        const tdex = await TDEX.deployed();
        const token = await TOKEN.deployed();

        last_execute_price = await tdex.lastExecutionPrice.call();
        //console.log("before trade last_execute_price", last_execute_price);


        maker_tx_fee_per_million = await tdex.makerTxFeePerMillion.call();
        taker_tx_fee_per_million = await tdex.takerTxFeePerMillion.call();
        million = await tdex.million.call();
        user3_ttc_before = await web3.eth.getBalance(user3);
        user7_ttc_before = await web3.eth.getBalance(user7);
        user3_token_before = await token.balanceOf.call(user3);
        user7_token_before = await token.balanceOf.call(user7);
        await tdex.executeOrder({from:executer});
        user3_ttc_after = await web3.eth.getBalance(user3);
        user7_ttc_after = await web3.eth.getBalance(user7);
        user3_token_after = await token.balanceOf.call(user3);
        user7_token_after = await token.balanceOf.call(user7);

        min_sell_price = await tdex.minSellPrice.call();
        assert.equal(min_sell_price.toNumber(), user3Price/order_decimal, "equal");
        max_buy_price = await tdex.maxBuyPrice.call();
        assert.equal(max_buy_price.toNumber(), user6Price/order_decimal,"equal");

        last_execute_price = await tdex.lastExecutionPrice.call();
        //console.log("after trade last_execute_price", last_execute_price);
        assert.equal(
            user7BuyNum.mul(million.sub(taker_tx_fee_per_million)).toString(10),
            user7_token_after.sub(user7_token_before).mul(million).toString(10),"equal");
        assert.equal(user7BuyNum.mul(last_execute_price).mul(million.sub(maker_tx_fee_per_million)).mul(order_decimal).toString(10),
            user3_ttc_after.sub(user3_ttc_before).mul(million).mul(decimal).toString(10) ,"equal");
        assert.equal(user7BuyNum.mul(user7Price.sub(last_execute_price.mul(order_decimal))).toString(10),
            user7_ttc_after.sub(user7_ttc_before).mul(decimal).toString(10) ,"equal");

    });


    it("user3 sell * 12 and cancel * 11",  async () =>  {
        const tdex = await TDEX.deployed();
        const token = await TOKEN.deployed();

        order = await tdex.allSellOrder.call(6);
        //console.log("order 6", order);

        // cancel 6
        // order_index = await tdex.getOrderIndex(user3Price/order_decimal, false, 6, 0, 10);
        // await tdex.cancelSellOrder(6, order_index, {from:user3});

        // sell * 11 order_id(8,9,10,11,12,13,14,15,16,17,18,19,20)
        for (i = 8; i < 20; i++) { 
            await tdex.addSellTokenOrder(user3SellNum, user3Price,{from:user3});
        }
        for (i = 8; i < 19; i++) { 
            order_index = await tdex.getOrderIndex(user3Price/order_decimal, false, i, 0, 20);
            await tdex.cancelSellOrder(i, order_index, {from:user3});
        }

        // user7 buy order_id(19)
        await tdex.addBuyTokenOrder(user7BuyNum, user7Price,{from:user7, to:tdex.address, value:user7DepositTTCNum});
        
        await tdex.executeOrder({from:executer});

        order = await tdex.allBuyOrder.call(20);
        assert.equal(order[1].toString(10), user7BuyNum.div(2).toString(10), "equal");
        assert.equal(order[2].toString(10), user7Price.div(order_decimal).toString(10), "equal");


        order = await tdex.allBuyOrder.call(6);
        assert.equal(order[1], 0, "equal");
        assert.equal(order[2], 0, "equal");


        await tdex.executeOrder({from:executer});

        order = await tdex.allBuyOrder.call(20);
        assert.equal(order[1].toString(10), user7BuyNum.div(2).toString(10), "equal");
        assert.equal(order[2].toString(10), user7Price.div(order_decimal).toString(10), "equal");

        await tdex.executeOrder({from:executer});

        order = await tdex.allSellOrder.call(19);
        assert.equal(order[1].toString(10), user3SellNum.sub(user7BuyNum.div(2)).toString(10), "equal");
        assert.equal(order[2].toString(10), user3Price.div(order_decimal).toString(10), "equal");

        order = await tdex.allBuyOrder.call(20);
        assert.equal(order[1], 0, "equal");
        assert.equal(order[2], 0, "equal");

    });

});
