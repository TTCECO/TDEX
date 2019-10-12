var TDEX = artifacts.require("./TDEX.sol");
var CLAY = artifacts.require("./CLAY.sol");
var CFIAT = artifacts.require("./CFIAT.sol");


contract('TDEX', function() {
  var eth = web3.eth;
  var owner = eth.accounts[0];

  var user1 = eth.accounts[1];
  var user1DepositTTCNum = 2 * 10 **18; //花费的TTC
  var user1BuyNum = 200 * 10 **18; //想要买的数量
  var user1Price = 0.01 * 10 ** 18

  var user2 = eth.accounts[2];
  var user2DepositTTCNum = 2.2 * 10 **18; //花费的TTC
  var user2BuyNum = 200 * 10 **18; //想要买的数量
  var user2Price = 0.011 * 10 ** 18

  var user3 = eth.accounts[3];
  var user3SellNum = 300 * 10**18
  var user3Price = 0.011 * 10 ** 18


  var user4 = eth.accounts[4];
  var user4SellNum = 300 * 10**18
  var user4Price = 0.01 * 10 ** 18

  var user5 = eth.accounts[5];


  var user6 = eth.accounts[6];
  var user6DepositTTCNum = 2.7 * 10 **18; //花费的TTC
  var user6BuyNum = 300 * 10 **18; //想要买的数量
  var user6Price = 9000000000000000;
  var user6UintPrice = 9;


  var user7 = eth.accounts[7];
  var user7DepositTTCNum = 2.8 * 10 **18; //花费的TTC
  var user7BuyNum = 200 * 10 **18; //想要买的数量
  var user7Price = 0.014 * 10 ** 18
 

  var ttpTotalSupply = 1000000000 * 10**18;

  var decimal = 10 ** 18;

  var order_decimal = 10 ** 15;

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



    it("add clay for tdex",  async () =>  {
        const tdex = await TDEX.deployed();
        const clay = await CLAY.deployed();
        await tdex.setTokenAddress(clay.address, {from:owner});
        clay_address = await tdex.MyToken.call();
        assert.equal(clay_address, clay.address, "equal");
    });


    it("user1 buy clay",  async () =>  {
        const tdex = await TDEX.deployed();
        await tdex.addBuyTokenOrder(user1BuyNum, user1Price,{from:user1, to:tdex.address, value:user1DepositTTCNum});

        max_buy_price = await tdex.maxBuyPrice.call();
        assert.equal(max_buy_price, user1Price/order_decimal, "equal");

        order = await tdex.allBuyOrder.call(1);
        assert.equal(order[1], user1BuyNum, "equal");
        assert.equal(order[2], user1Price/order_decimal, "equal");
    });


    it("user2 buy clay",  async () =>  {
        const tdex = await TDEX.deployed();
        await tdex.addBuyTokenOrder(user2BuyNum, user2Price,{from:user2, to:tdex.address, value:user2DepositTTCNum});

        max_buy_price = await tdex.maxBuyPrice.call();
        assert.equal(max_buy_price, user2Price/order_decimal, "equal");

        order = await tdex.allBuyOrder.call(2);
        assert.equal(order[1], user2BuyNum, "equal");
        assert.equal(order[2], user2Price/order_decimal, "equal");
    });

    

    it("transfer clay to user3 and user4",  async () =>  {
        //const tdex = await TDEX.deployed();
        const clay = await CLAY.deployed();
        const tdex = await TDEX.deployed();
        await clay.transfer(user3,user3SellNum*20, {from:owner});
        await clay.transfer(user4,user4SellNum*20, {from:owner});
        
        user3_clay_balance = await clay.balanceOf.call(user3);
        assert.equal(user3_clay_balance, user3SellNum*20, "equal");

        user4_clay_balance = await clay.balanceOf.call(user4);
        assert.equal(user4_clay_balance, user4SellNum*20, "equal");


        await clay.approve(tdex.address,user3SellNum*20, {from:user3});
        await clay.approve(tdex.address,user4SellNum*20, {from:user4});
        
    });


    it("user3 sell clay",  async () =>  {
        const tdex = await TDEX.deployed();
        const clay = await CLAY.deployed();

        // transfer clay to user3 and user4
        await tdex.addSellTokenOrder(user3SellNum, user3Price,{from:user3});

        min_sell_price = await tdex.minSellPrice.call();
        assert.equal(min_sell_price, user3Price/order_decimal, "equal");

        order = await tdex.allSellOrder.call(3);
        assert.equal(order[1], user3SellNum, "equal");
        assert.equal(order[2], user3Price/order_decimal, "equal");

        user3_clay_balance = await clay.balanceOf.call(user3);
        assert.equal(user3_clay_balance, user3SellNum*20-user3SellNum, "equal");
        
    });

    it("user4 sell clay",  async () =>  {
        const tdex = await TDEX.deployed();

        // transfer clay to user3 and user4
        await tdex.addSellTokenOrder(user4SellNum, user4Price,{from:user4});

        min_sell_price = await tdex.minSellPrice.call();
        assert.equal(min_sell_price, user4Price/order_decimal, "equal");

        order = await tdex.allSellOrder.call(4);

        assert.equal(order[1], user4SellNum, "equal");
        assert.equal(order[2], user4Price/order_decimal, "equal");

        
    });


    it("user6 buy clay",  async () =>  {
        const tdex = await TDEX.deployed();
        await tdex.addBuyTokenOrder(user6BuyNum, user6Price,{from:user6, to:tdex.address, value:user6DepositTTCNum});

        max_buy_price = await tdex.maxBuyPrice.call();
        assert.equal(max_buy_price, user2Price/order_decimal, "equal");

        order = await tdex.allBuyOrder.call(5);
        assert.equal(order[1], user6BuyNum, "equal");
        assert.equal(order[2], user6UintPrice, "equal");
    });


    


    it("user5 execute order",  async () =>  {

        const tdex = await TDEX.deployed();

        last_execute_price = await tdex.lastExecutionPrice.call();
        console.log("before trade last_execute_price", last_execute_price);

        
        price1_orders = await tdex.getOrderPriceDetails.call(10, 0, true);
        price2_orders = await tdex.getOrderPriceDetails.call(11, 0, true);

        price3_orders = await tdex.getOrderPriceDetails.call(11, 0, false);
        price4_orders = await tdex.getOrderPriceDetails.call(10, 0, false);
        
        console.log("xxx", price1_orders, price2_orders, price3_orders, price4_orders);

        max_buy_price = await tdex.maxBuyPrice.call();
        assert.equal(max_buy_price, user2Price/order_decimal, "equal");

        min_sell_price = await tdex.minSellPrice.call();
        assert.equal(min_sell_price, user4Price/order_decimal, "equal");


        // transfer clay to user3 and user4
        await tdex.executeOrder({from:user5});

        min_sell_price = await tdex.minSellPrice.call();
        assert.equal(min_sell_price, user4Price/order_decimal, "equal");

        max_buy_price = await tdex.maxBuyPrice.call();
        assert.equal(max_buy_price, user1Price/order_decimal, "equal");

        price1_orders = await tdex.getOrderPriceDetails.call(10, 0, true);
        price2_orders = await tdex.getOrderPriceDetails.call(11, 0, true);

        price3_orders = await tdex.getOrderPriceDetails.call(11, 0, false);
        price4_orders = await tdex.getOrderPriceDetails.call(10, 0, false);
        
        console.log("yyy", price1_orders, price2_orders, price3_orders, price4_orders);

        last_execute_price = await tdex.lastExecutionPrice.call();
        console.log("after trade last_execute_price", last_execute_price);
        
        
    });


    it("user5 execute order again",  async () =>  {

        const tdex = await TDEX.deployed();

        last_execute_price = await tdex.lastExecutionPrice.call();
        console.log("before trade last_execute_price", last_execute_price);

        
        price1_orders = await tdex.getOrderPriceDetails.call(10, 0, true);
        price2_orders = await tdex.getOrderPriceDetails.call(11, 0, true);
        price3_orders = await tdex.getOrderPriceDetails.call(11, 0, false);
        price4_orders = await tdex.getOrderPriceDetails.call(10, 0, false);
        
        console.log("xxx", price1_orders, price2_orders, price3_orders, price4_orders);

        await tdex.executeOrder({from:user5});

        min_sell_price = await tdex.minSellPrice.call();
        assert.equal(min_sell_price, user3Price/order_decimal, "equal");
        max_buy_price = await tdex.maxBuyPrice.call();
        assert.equal(max_buy_price, user1Price/order_decimal, "equal");

        price1_orders = await tdex.getOrderPriceDetails.call(10, 0, true);
        price2_orders = await tdex.getOrderPriceDetails.call(11, 0, true);
        price3_orders = await tdex.getOrderPriceDetails.call(11, 0, false);
        price4_orders = await tdex.getOrderPriceDetails.call(10, 0, false);
        
        console.log("yyy", price1_orders, price2_orders, price3_orders, price4_orders);

        last_execute_price = await tdex.lastExecutionPrice.call();
        console.log("after trade last_execute_price", last_execute_price);

        
    });



    it("user1 cancel order",  async () =>  {
        const tdex = await TDEX.deployed();

        // transfer clay to user3 and user4
        order_index = await tdex.getOrderIndex(user1Price/order_decimal, true, 1, 0, 10);
        assert.equal(order_index, 0)

        await tdex.cancelBuyOrder(1, order_index, {from:user1});

        max_buy_price = await tdex.maxBuyPrice.call();
        assert.equal(max_buy_price, user6UintPrice, "equal");

        order = await tdex.allBuyOrder.call(1);
        assert.equal(order[1], 0, "equal");
        assert.equal(order[2], 0, "equal");
        
    });

    it("user3 cancel order",  async () =>  {
        const tdex = await TDEX.deployed();
        const clay = await CLAY.deployed();

        // transfer clay to user3 and user4
        order_index = await tdex.getOrderIndex(user3Price/order_decimal, false, 3, 0, 10);
        assert.equal(order_index, 0)

        await tdex.cancelSellOrder(3, order_index, {from:user3});

        min_sell_price = await tdex.minSellPrice.call();
        assert.equal(min_sell_price, user3Price/order_decimal, "equal");

        order = await tdex.allBuyOrder.call(3);
        assert.equal(order[1], 0, "equal");
        assert.equal(order[2], 0, "equal");

        user3_clay_balance = await clay.balanceOf.call(user3);
        assert.equal(user3_clay_balance, user3SellNum*20, "equal");
        
    });



    it("user3 sell clay",  async () =>  {
        const tdex = await TDEX.deployed();
        const clay = await CLAY.deployed();

        // transfer clay to user3 and user4
        await tdex.addSellTokenOrder(user3SellNum, user3Price,{from:user3});

        min_sell_price = await tdex.minSellPrice.call();
        assert.equal(min_sell_price, user3Price/order_decimal, "equal");

        order = await tdex.allSellOrder.call(6);
        assert.equal(order[1], user3SellNum, "equal");
        assert.equal(order[2], user3Price/order_decimal, "equal");

        user3_clay_balance = await clay.balanceOf.call(user3);
        assert.equal(user3_clay_balance, user3SellNum*20-user3SellNum, "equal");
        
    });

    it("user7 buy clay",  async () =>  {
        const tdex = await TDEX.deployed();
        await tdex.addBuyTokenOrder(user2BuyNum, user7Price,{from:user7, to:tdex.address, value:user7DepositTTCNum});

        max_buy_price = await tdex.maxBuyPrice.call();
        assert.equal(max_buy_price, user7Price/order_decimal, "equal");

        order = await tdex.allBuyOrder.call(7);
        assert.equal(order[1], user7BuyNum, "equal");
        assert.equal(order[2], user7Price/order_decimal, "equal");
    });

    it("user5 execute order after someone cancel",  async () =>  {

        const tdex = await TDEX.deployed();

        last_execute_price = await tdex.lastExecutionPrice.call();
        console.log("before trade last_execute_price", last_execute_price);

        await tdex.executeOrder({from:user5});

        min_sell_price = await tdex.minSellPrice.call();
        assert.equal(min_sell_price, user3Price/order_decimal, "equal");
        max_buy_price = await tdex.maxBuyPrice.call();
        assert.equal(max_buy_price, user6UintPrice, "equal");

        last_execute_price = await tdex.lastExecutionPrice.call();
        console.log("after trade last_execute_price", last_execute_price);

        
    });


    it("user3 sell * 12 and cancel * 11",  async () =>  {
        const tdex = await TDEX.deployed();
        const clay = await CLAY.deployed();


        order = await tdex.allSellOrder.call(6);
        console.log("order 6", order);

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
        
        await tdex.executeOrder({from:user5});

        order = await tdex.allBuyOrder.call(20);
        assert.equal(order[1], user7BuyNum/2, "equal");
        assert.equal(order[2], user7Price/order_decimal, "equal");


        order = await tdex.allBuyOrder.call(6);
        assert.equal(order[1], 0, "equal");
        assert.equal(order[2], 0, "equal");


        await tdex.executeOrder({from:user5});

        order = await tdex.allBuyOrder.call(20);
        assert.equal(order[1], user7BuyNum/2, "equal");
        assert.equal(order[2], user7Price/order_decimal, "equal");

        await tdex.executeOrder({from:user5});

        order = await tdex.allSellOrder.call(19);
        assert.equal(order[1], user3SellNum-user7BuyNum/2, "equal");
        assert.equal(order[2], user3Price/order_decimal, "equal");

        order = await tdex.allBuyOrder.call(20);
        assert.equal(order[1], 0, "equal");
        assert.equal(order[2], 0, "equal");

    });
    


});
