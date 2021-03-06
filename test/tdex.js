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

    var decimal = new web3.BigNumber('1000000000000000000');  // 10**18
    var order_decimal = new web3.BigNumber('1000000000000000'); // 10**15
    var million = new web3.BigNumber('1000000'); //10**6

    var makerFeeRate = 1000;
    var takerFeeRate = 3000;

    var users_init_data = [{"type":true,"num":200,"price":0.01},  // true is buy, false is sell
                {"type":true,"num":200,"price":0.011},
                {"type":false,"num":300,"price":0.011},
                {"type":false,"num":300,"price":0.01},
                {"type":true,"num":300,"price":0.009},
                {"type":true,"num":200,"price":0.014}];
    var user = {};            
    for (k in users_init_data) {
        var u = users_init_data[k];
        k = parseInt(k) + 1;
        user[k] = ({"addr":eth.accounts[k],
            "type":u.type,
            "num":decimal.mul(u.num),
            "price":decimal.mul(u.price).floor(),
            "ttc_num":decimal.mul(u.num).mul(u.price).floor(),
        })
    }           

    var executer = eth.accounts[7];
    var operator = eth.accounts[8];
    var adminWithdrawAddress = eth.accounts[9];

	function getBalance(addr){
        return web3.fromWei(web3.eth.getBalance(addr), "ether");
	}

    function printLogs(logs) {
        for (i=0;i<logs.length ;i++){
            console.log("TE","t",logs[i].args.t.toString(10),
            "address",logs[i].args.addr ,
            "orderID",logs[i].args.orderID.toString(10),
            "index",logs[i].args.index.toString(10),
            "amount",logs[i].args.amount.toString(10),"price",logs[i].args.price.toString(10), "sign",logs[i].args.sign );
        }
    }

	function printBalance() {
        var balance = web3.eth.getBalance(owner);
        console.log("Owner    balance:", web3.fromWei(balance, "ether").toString(), "TTC");

        for (i=1;i<10;i++){
            balance = web3.eth.getBalance(user[1].addr);
            if (i < 7){
                console.log("user",i,"  balance:", web3.fromWei(balance, "ether").toString(), "TTC");
            }else if (i==7){
                console.log("executor balance:", web3.fromWei(balance, "ether").toString(), "TTC");
            }else if (i==8){
                console.log("operator balance:", web3.fromWei(balance, "ether").toString(), "TTC");
            }else if (i==9){
                console.log("withdraw balance:", web3.fromWei(balance, "ether").toString(), "TTC");

            }
        }
  	
    }

  	it("start ",function(){
    	return TDEX.deployed().then(function(content){
      		printBalance();
    	});
  	});

    it("update order decimal ",async () => {
        const tdex = await TDEX.deployed();
        od = await tdex.orderDecimals.call();
        if (od.toNumber() == 13 ) {
            order_decimal = new web3.BigNumber('10000000000000');
        }else if (od.toNumber() == 14 ){
            order_decimal = new web3.BigNumber('100000000000000');
        }else if (od.toNumber() == 15 ){
            order_decimal = new web3.BigNumber('1000000000000000');
        }else if (od.toNumber() == 16 ){
            order_decimal = new web3.BigNumber('10000000000000000');
        }else if (od.toNumber() == 17 ){
            order_decimal = new web3.BigNumber('100000000000000000');
        }
    });

    it("add token, adminWithdrawAddress and operator for tdex",  async () =>  {
        const tdex = await TDEX.deployed();
        const token = await TOKEN.deployed();
        // add token
        await tdex.initAddressSettings(2,token.address, {from:owner});
        token_address = await tdex.MyToken.call();
        assert.equal(token_address, token.address, "equal");
        // add adminWithDrawAddress
        await tdex.initAddressSettings(1,adminWithdrawAddress, {from:owner});
        withdraw_address = await tdex.adminWithdrawAddress.call();
        assert.equal(withdraw_address, adminWithdrawAddress, "equal");
        // add operator
        await tdex.addOperator(operator,{from:owner});
    });

    it("set maker & taker fee rate for tdex",  async () =>  {
        const tdex = await TDEX.deployed();
        // set taker fee rate
        await tdex.setTakerFeeRate(takerFeeRate, {from:operator});
        rate = await tdex.takerFeeRate.call();
        assert.equal(rate, takerFeeRate, "equal");
        // set maker fee rate
        await tdex.setMakerFeeRate(makerFeeRate, {from:operator});
        rate = await tdex.makerFeeRate.call();
        assert.equal(rate, makerFeeRate, "equal");

    });

    it("user1 buy token",  async () =>  {
        const tdex = await TDEX.deployed();
        value = user[1].ttc_num.mul(million.add(takerFeeRate)).div(million);
        await tdex.addBuyTokenOrder(user[1].price,{from:user[1].addr, to:tdex.address, value:value}).then(function(info){
            assert.equal(info.logs[0].event, "TE", "equal");
            assert.equal(info.logs[0].args.t, 1, "equal");
            assert.equal(info.logs[0].args.addr, user[1].addr, "equal");
            assert.equal(info.logs[0].args.amount.toString(10), user[1].num.toString(10), "equal");
            assert.equal(info.logs[0].args.price.toString(10), user[1].price.toString(10) , "equal");
            assert.equal(info.logs[0].args.sign, false, "equal");

            user[1].index = info.logs[0].args.index;
            user[1].order_id = info.logs[0].args.orderID;
        });

        max_buy_price = await tdex.maxBuyPrice.call();
        assert.equal(max_buy_price, user[1].price/order_decimal, "equal");

        order = await tdex.allBuyOrder.call(1);
        assert.equal(order[1].toString(10), user[1].num.toString(10), "equal");
        assert.equal(order[2].toString(10), user[1].price.div(order_decimal).toString(10), "equal");

        amount = await tdex.buyAmountByPrice.call(order[2]); // price = 0.01
        assert.equal(amount.toString(10), user[1].num.toString(10), "equal");
    });

    it("try add buy order less than min token amount ",async () => {    
        const tdex = await TDEX.deployed();
        tdex.setMinOrderValue(user[2].ttc_num * 2, {from:operator});
        var gotErr = false;
        await tdex.addBuyTokenOrder( user[2].price,{from:user[2].addr, to:tdex.address, value:user[2].ttc_num}).catch(function(error) {
            gotErr = true;
            assert(error.toString().includes('Error: VM Exception while processing transaction: revert'), error.toString())
            
        });
        assert.equal(gotErr, true, "equal");
        await tdex.setMinOrderValue(2*10**18, {from:operator});
    });

    it("user2 buy token",  async () =>  {
        const tdex = await TDEX.deployed();
        value = user[2].ttc_num.mul(million.add(takerFeeRate)).div(million);
        await tdex.addBuyTokenOrder(user[2].price,{from:user[2].addr, to:tdex.address, value:value});

        max_buy_price = await tdex.maxBuyPrice.call();
        assert.equal(max_buy_price, user[2].price/order_decimal, "equal");

        order = await tdex.allBuyOrder.call(2);
        assert.equal(order[1].toString(10), user[2].num.toString(10), "equal");
        assert.equal(order[2].toString(10), user[2].price.div(order_decimal).toString(10), "equal");

        amount = await tdex.buyAmountByPrice.call(order[2]); // price = 0.011
        assert.equal(amount.toString(10), user[2].num.toString(10), "equal");
    });


    it("transfer token to user3 and user4",  async () =>  {
        //const tdex = await TDEX.deployed();
        const token = await TOKEN.deployed();
        const tdex = await TDEX.deployed();

        if (targetToken == 'CFIAT') {
                await token.addOperator(owner,{from:owner});
                await token.create(owner,25*10**26,{from:owner});
        }

        await token.transfer(user[3].addr,user[3].num*20, {from:owner});
        await token.transfer(user[4].addr,user[4].num*20, {from:owner});
        
        user3_token_balance = await token.balanceOf.call(user[3].addr);
        assert.equal(user3_token_balance.toString(10), user[3].num.mul(20).toString(10), "equal");

        user4_token_balance = await token.balanceOf.call(user[4].addr);
        assert.equal(user4_token_balance.toString(10), user[4].num.mul(20).toString(10), "equal");


        await token.approve(tdex.address,user[3].num*20, {from:user[3].addr});
        await token.approve(tdex.address,user[4].num*20, {from:user[4].addr});
        
    });


    it("user3 sell token",  async () =>  {
        const tdex = await TDEX.deployed();
        const token = await TOKEN.deployed();

        // transfer token to user3 and user4
        await tdex.addSellTokenOrder(user[3].num, user[3].price,{from:user[3].addr}).then(function(info){
            assert.equal(info.logs[0].event, "TE", "equal");
            assert.equal(info.logs[0].args.t, 2, "equal");
            assert.equal(info.logs[0].args.addr, user[3].addr, "equal");
            assert.equal(info.logs[0].args.amount.toString(10), user[3].num.toString(10), "equal");
            assert.equal(info.logs[0].args.price.toString(10), user[3].price.toString(10) , "equal");
            assert.equal(info.logs[0].args.sign, false , "equal");

            user[3].index = info.logs[0].args.index;
            user[3].order_id = info.logs[0].args.orderID;
        });


        min_sell_price = await tdex.minSellPrice.call();
        assert.equal(min_sell_price, user[3].price/order_decimal, "equal");

        order = await tdex.allSellOrder.call(3);
        assert.equal(order[1].toString(10), user[3].num.toString(10), "equal");
        assert.equal(order[2].toString(10), user[3].price.div(order_decimal).toString(10), "equal");

        user3_token_balance = await token.balanceOf.call(user[3].addr);
        assert.equal(user3_token_balance.toString(10), user[3].num*20-user[3].num.toString(10), "equal");
        
        amount = await tdex.sellAmountByPrice.call(order[2]); // price = 0.011
        assert.equal(amount.toString(10), user[3].num.toString(10), "equal");
    });


    it("user4 sell token",  async () =>  {
        const tdex = await TDEX.deployed();

        // transfer token to user3 and user4
        await tdex.addSellTokenOrder(user[4].num, user[4].price,{from:user[4].addr});

        min_sell_price = await tdex.minSellPrice.call();
        assert.equal(min_sell_price.toString(10), user[4].price.div(order_decimal).toString(10), "equal");

        order = await tdex.allSellOrder.call(4);

        assert.equal(order[1].toString(10), user[4].num.toString(10), "equal");
        assert.equal(order[2].toString(10), user[4].price.div(order_decimal).toString(10), "equal");

        amount = await tdex.sellAmountByPrice.call(order[2]); // price = 0.01
        assert.equal(amount.toString(10), user[4].num.toString(10), "equal");
    });


    it("user5 buy token",  async () =>  {
        const tdex = await TDEX.deployed();
        value = user[5].ttc_num.mul(million.add(takerFeeRate)).div(million);
        await tdex.addBuyTokenOrder(user[5].price,{from:user[5].addr, to:tdex.address, value:value});

        max_buy_price = await tdex.maxBuyPrice.call();
        assert.equal(max_buy_price.toString(10), user[2].price.div(order_decimal).toString(10), "equal");

        order = await tdex.allBuyOrder.call(5);
        assert.equal(order[1].toString(10), user[5].num.toString(10), "equal");
        assert.equal(order[2].toString(10), user[5].price.div(order_decimal).toString(10),"equal");

        amount = await tdex.buyAmountByPrice.call(order[2]); // price = 0.009
        assert.equal(amount.toString(10), user[5].num.toString(10), "equal");
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
        

        max_buy_price = await tdex.maxBuyPrice.call();
        assert.equal(max_buy_price.toString(10), user[2].price.div(order_decimal).toString(10), "equal");

        min_sell_price = await tdex.minSellPrice.call();
        assert.equal(min_sell_price.toString(10), user[4].price.div(order_decimal).toString(10), "equal");

        maker_tx_fee_per_million = await tdex.makerFeeRate.call();
        taker_tx_fee_per_million = await tdex.takerFeeRate.call();
        million = await tdex.million.call();
        user4_ttc_before = await web3.eth.getBalance(user[4].addr);
        user2_token_before = await token.balanceOf.call(user[2].addr);
        // transfer token from user4 to user2
        await tdex.executeOrder({from:executer}).then(function(info){
            //console.log(info.logs);
            
            assert.equal(info.logs.length<=4,true, "equal"); // no refund & no collect trade fee

            assert.equal(info.logs[0].event, "TE", "equal");
            assert.equal(info.logs[1].event, "TE", "equal");

            assert.equal(info.logs[0].args.t, 3, "equal");
            assert.equal(info.logs[1].args.t, 4, "equal");

            assert.equal(info.logs[0].args.addr, user[2].addr, "equal");
            assert.equal(info.logs[1].args.addr, user[4].addr, "equal");

            assert.equal(info.logs[0].args.amount.toString(10),
                info.logs[1].args.amount.toString(10) , "equal");
            assert.equal(info.logs[0].args.price.toString(10),
                info.logs[1].args.price.toString(10) , "equal");

            assert.equal(info.logs[0].args.sign, true, "equal");
            assert.equal(info.logs[1].args.sign, false, "equal");

        });
        user4_ttc_after = await web3.eth.getBalance(user[4].addr);
        user2_token_after = await token.balanceOf.call(user[2].addr);


        min_sell_price = await tdex.minSellPrice.call();
        assert.equal(min_sell_price.toString(10), user[4].price.div(order_decimal).toString(10), "equal");

        max_buy_price = await tdex.maxBuyPrice.call();
        assert.equal(max_buy_price.toString(10), user[1].price.div(order_decimal).toString(10), "equal");

        price1_orders = await tdex.getOrderPriceDetails.call(10, 0, true);
        price2_orders = await tdex.getOrderPriceDetails.call(11, 0, true);
        price3_orders = await tdex.getOrderPriceDetails.call(11, 0, false);
        price4_orders = await tdex.getOrderPriceDetails.call(10, 0, false);
        

        last_execute_price = await tdex.lastExecutionPrice.call();

        
        assert.equal(user[2].num.toString(10),
            user2_token_after.sub(user2_token_before).toString(10),
            "equal");
        
        assert.equal(user[2].num.mul(last_execute_price).mul(million.sub(taker_tx_fee_per_million)).div(million).div(decimal).toString(10) ,
            user4_ttc_after.sub(user4_ttc_before).div(order_decimal).toString(10),"equal");


        amount = await tdex.buyAmountByPrice.call(user[2].price.div(order_decimal)); // price = 0.011
        assert.equal(amount, 0, "equal");

        amount = await tdex.sellAmountByPrice.call(user[4].price.div(order_decimal)); // price = 0.01
        assert.equal(amount.toString(10), (user[4].num).sub(user[2].num).toString(10), "equal");
    });


    it("executer execute order again",  async () =>  {

        const tdex = await TDEX.deployed();
        const token = await TOKEN.deployed();

        last_execute_price = await tdex.lastExecutionPrice.call();
        
        price1_orders = await tdex.getOrderPriceDetails.call(10, 0, true);
        price2_orders = await tdex.getOrderPriceDetails.call(11, 0, true);
        price3_orders = await tdex.getOrderPriceDetails.call(11, 0, false);
        price4_orders = await tdex.getOrderPriceDetails.call(10, 0, false);
        

        maker_tx_fee_per_million = await tdex.makerFeeRate.call();
        taker_tx_fee_per_million = await tdex.takerFeeRate.call();
        million = await tdex.million.call();
        user4_ttc_before = await web3.eth.getBalance(user[4].addr);
        user1_token_before = await token.balanceOf.call(user[1].addr);
        await tdex.executeOrder({from:executer});
        user4_ttc_after = await web3.eth.getBalance(user[4].addr);
        user1_token_after = await token.balanceOf.call(user[1].addr);


        min_sell_price = await tdex.minSellPrice.call();
        assert.equal(min_sell_price.toString(10), user[3].price.div(order_decimal).toString(10), "equal");
        max_buy_price = await tdex.maxBuyPrice.call();
        assert.equal(max_buy_price.toString(10), user[1].price.div(order_decimal).toString(10), "equal");

        price1_orders = await tdex.getOrderPriceDetails.call(10, 0, true);
        price2_orders = await tdex.getOrderPriceDetails.call(11, 0, true);
        price3_orders = await tdex.getOrderPriceDetails.call(11, 0, false);
        price4_orders = await tdex.getOrderPriceDetails.call(10, 0, false);
        

        last_execute_price = await tdex.lastExecutionPrice.call();

        assert.equal(user[4].num.sub(user[2].num).toString(10),
            user1_token_after.sub(user1_token_before).toString(10),"equal");

        assert.equal(user[4].num.sub(user[2].num).mul(last_execute_price).mul(million.sub(taker_tx_fee_per_million)).div(million).div(decimal).toString(10),
            user4_ttc_after.sub(user4_ttc_before).div(order_decimal).toString(10),"equal");


        amount = await tdex.buyAmountByPrice.call(user[1].price.div(order_decimal)); // price = 0.011
        assert.equal(amount.toString(10), 
            (user[1].num).sub((user[4].num).sub(user[2].num)).toString(10), "equal");

        amount = await tdex.sellAmountByPrice.call(user[4].price.div(order_decimal)); // price = 0.01
        assert.equal(amount.toString(10), 0, "equal");
    });


    it("user1 cancel order",  async () =>  {
        const tdex = await TDEX.deployed();

        // 
        order_index = await tdex.getOrderIndex(user[1].price, true, user[1].order_id, 0, 10);
        assert.equal(order_index.toString(10), user[1].index.toString(10));
        await tdex.cancelBuyOrder(user[1].order_id, order_index, {from:user[1].addr});

        max_buy_price = await tdex.maxBuyPrice.call();
        assert.equal(max_buy_price.toString(10), user[5].price.div(order_decimal).toString(10),"equal");

        order = await tdex.allBuyOrder.call(1);
        assert.equal(order[1], 0, "equal");
        assert.equal(order[2], 0, "equal");
        
    });

    it("user3 cancel order",  async () =>  {
        const tdex = await TDEX.deployed();
        const token = await TOKEN.deployed();

        // 
        order_index = await tdex.getOrderIndex(user[3].price, false, user[3].order_id, 0, 10);
        assert.equal(order_index.toString(10), user[3].index.toString(10))

        await tdex.cancelSellOrder(user[3].order_id, order_index, {from:user[3].addr});

        order = await tdex.allBuyOrder.call(3);
        assert.equal(order[1], 0, "equal");
        assert.equal(order[2], 0, "equal");

        user3_token_balance = await token.balanceOf.call(user[3].addr);
        assert.equal(user3_token_balance, user[3].num*20, "equal");
        
    });


    it("user3 sell token",  async () =>  {
        const tdex = await TDEX.deployed();
        const token = await TOKEN.deployed();

        // 
        await tdex.addSellTokenOrder(user[3].num, user[3].price,{from:user[3].addr});

        min_sell_price = await tdex.minSellPrice.call();
        assert.equal(min_sell_price, user[3].price/order_decimal, "equal");

        order = await tdex.allSellOrder.call(6);
        assert.equal(order[1].toString(10), user[3].num.toString(10), "equal");
        assert.equal(order[2].toString(10), user[3].price.div(order_decimal).toString(10), "equal");

        user3_token_balance = await token.balanceOf.call(user[3].addr);
        assert.equal(user3_token_balance.toString(10), user[3].num.mul(20).sub(user[3].num).toString(10), "equal");

    });

    it("user6 buy token",  async () =>  {
        const tdex = await TDEX.deployed();
        value =user[6].ttc_num.mul(million.add(takerFeeRate)).div(million)
        await tdex.addBuyTokenOrder( user[6].price,{from:user[6].addr, to:tdex.address, value:value});

        max_buy_price = await tdex.maxBuyPrice.call();
        assert.equal(max_buy_price.toString(10), user[6].price.div(order_decimal).toString(10), "equal");

        order = await tdex.allBuyOrder.call(7);
        assert.equal(order[1].toString(10), user[6].num.toString(10), "equal");
        assert.equal(order[2].toString(10), user[6].price.div(order_decimal).toString(10), "equal");

    });

    it("executer execute order after someone cancel",  async () =>  {

        const tdex = await TDEX.deployed();
        const token = await TOKEN.deployed();
        var refund = 0;

        last_execute_price = await tdex.lastExecutionPrice.call();
        //console.log("before trade last_execute_price", last_execute_price);


        maker_tx_fee_per_million = await tdex.makerFeeRate.call();
        taker_tx_fee_per_million = await tdex.takerFeeRate.call();
        million = await tdex.million.call();
        user3_ttc_before = await web3.eth.getBalance(user[3].addr);
        user6_ttc_before = await web3.eth.getBalance(user[6].addr);
        user3_token_before = await token.balanceOf.call(user[3].addr);
        user6_token_before = await token.balanceOf.call(user[6].addr);

        await tdex.executeOrder({from:executer}).then(function(info){
            //console.log(info.logs);
            assert.equal(info.logs.length <= 4, true, "equal"); // no refund & no collect trade fee
            assert.equal(info.logs[2].event, "TE", "equal");
            assert.equal(info.logs[2].args.t, 7, "equal");
            assert.equal(info.logs[2].args.addr, user[6].addr, "equal");
            refund = info.logs[2].args.amount.mul(info.logs[2].args.price);
            assert.equal(info.logs[0].args.sign, false, "equal");

        });

        user3_ttc_after = await web3.eth.getBalance(user[3].addr);
        user6_ttc_after = await web3.eth.getBalance(user[6].addr);
        user3_token_after = await token.balanceOf.call(user[3].addr);
        user6_token_after = await token.balanceOf.call(user[6].addr);

        min_sell_price = await tdex.minSellPrice.call();
        assert.equal(min_sell_price.toNumber(), user[3].price/order_decimal, "equal");
        max_buy_price = await tdex.maxBuyPrice.call();
        assert.equal(max_buy_price.toNumber(), user[5].price/order_decimal,"equal");

        last_execute_price = await tdex.lastExecutionPrice.call();
        //console.log("after trade last_execute_price", last_execute_price);
        assert.equal(user[6].num.toString(10),user6_token_after.sub(user6_token_before).toString(10),"equal");

        assert.equal(user[6].num.mul(last_execute_price).mul(million.sub(maker_tx_fee_per_million)).mul(order_decimal).toString(10),
            user3_ttc_after.sub(user3_ttc_before).mul(million).mul(decimal).toString(10) ,"equal");

        assert.equal(refund.toString(10),
            user6_ttc_after.sub(user6_ttc_before).mul(decimal).toString(10) ,"equal");

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
            await tdex.addSellTokenOrder(user[3].num, user[3].price,{from:user[3].addr});
        }
        for (i = 8; i < 19; i++) { 
            order_index = await tdex.getOrderIndex(user[3].price, false, i, 0, 20);
            await tdex.cancelSellOrder(i, order_index, {from:user[3].addr});
        }

        // user6 buy order_id(19)
        value = user[6].ttc_num.mul(million.add(takerFeeRate)).div(million);
        await tdex.addBuyTokenOrder( user[6].price,{from:user[6].addr, to:tdex.address, value:value});
        
        await tdex.executeOrder({from:executer});

        order = await tdex.allBuyOrder.call(20);
        assert.equal(order[1].toString(10), user[6].num.div(2).toString(10), "equal");
        assert.equal(order[2].toString(10), user[6].price.div(order_decimal).toString(10), "equal");


        order = await tdex.allBuyOrder.call(6);
        assert.equal(order[1], 0, "equal");
        assert.equal(order[2], 0, "equal");


        await tdex.executeOrder({from:executer});

        order = await tdex.allBuyOrder.call(20);
        assert.equal(order[1].toString(10), user[6].num.div(2).toString(10), "equal");
        assert.equal(order[2].toString(10), user[6].price.div(order_decimal).toString(10), "equal");

        await tdex.executeOrder({from:executer});

        order = await tdex.allSellOrder.call(19);
        assert.equal(order[1].toString(10), user[3].num.sub(user[6].num.div(2)).toString(10), "equal");
        assert.equal(order[2].toString(10), user[3].price.div(order_decimal).toString(10), "equal");

        order = await tdex.allBuyOrder.call(20);
        assert.equal(order[1], 0, "equal");
        assert.equal(order[2], 0, "equal");

    });


    it("reset maxPriceRange",  async () =>  {
        const tdex = await TDEX.deployed();
        const token = await TOKEN.deployed();

        max_price_range = await tdex.maxPriceRange.call();
        //console.log("max_price_range" , max_price_range.toNumber())
        target_value = max_price_range.toNumber() -290 ;
        //console.log("target_value",target_value)
        await tdex.setMaxPriceRange(target_value, {from:operator});
        max_price_range = await tdex.maxPriceRange.call();
        //console.log("max_price_range" , max_price_range.toNumber())
        assert.equal(max_price_range.toNumber(), target_value, "equal");
    });

    it("operator auth", async () => {
        const tdex = await TDEX.deployed();
        const token = await TOKEN.deployed();
        max_price_range = await tdex.maxPriceRange.call();
        var gotErr = false;
        await tdex.setMaxPriceRange(max_price_range,{from:user[6].addr}).catch(function(error) {
            gotErr = true;
            assert(error.toString().includes('Error: VM Exception while processing transaction: revert'), error.toString())           
        });
        assert.equal(gotErr, true, "equal");
        await tdex.setMaxPriceRange(max_price_range,{from:operator})
    });


    it("try add orders beyond price range",async () => {    
        const tdex = await TDEX.deployed();
        max_price_range = await tdex.maxPriceRange.call();
        last_execute_price = await tdex.lastExecutionPrice.call();

        //console.log("max_price_range", max_price_range);
        //console.log("max_price_range by wei", order_decimal.mul(max_price_range).toString());
        //console.log("last_execute_price", order_decimal.mul(last_execute_price).toString());
        
        ttc_num = 200;
        num = decimal.mul(ttc_num);
        // add buy order fail
        beyond_price = order_decimal.mul(last_execute_price).add(order_decimal.mul(max_price_range));
        //console.log("beyond_price",beyond_price.toString());
        beyond_value = beyond_price.mul(ttc_num).mul(million.add(takerFeeRate)).div(million);
        //console.log("beyong_value",beyond_value.toString());

        ok_price = beyond_price.sub(order_decimal);
        ok_value = ok_price.mul(ttc_num).mul(million.add(takerFeeRate)).div(million);
        //console.log("ok_price",ok_price.toString());
        var gotErr = false;
        await tdex.addBuyTokenOrder(beyond_price,{from:owner, to:tdex.address, value:beyond_value}).catch(function(error) {
            gotErr = true;
            assert(error.toString().includes('Error: VM Exception while processing transaction: revert'), error.toString())           
        });
        assert.equal(gotErr, true, "equal");

        // add buy order success
        await tdex.addBuyTokenOrder( ok_price,{from:owner, to:tdex.address, value:ok_value}).then(function(info){
            assert.equal(info.logs[0].event, "TE", "equal");
            assert.equal(info.logs[0].args.t, 1, "equal");
            assert.equal(info.logs[0].args.addr, owner, "equal");
            assert.equal(info.logs[0].args.amount.toString(10), num.toString(10), "equal");
            assert.equal(info.logs[0].args.price.toString(10), ok_price.toString(10) , "equal");
            assert.equal(info.logs[0].args.sign, false , "equal");
        });
    });


    it("re-add buy order to tdex && cancel order by admin",  async () =>  {
        const tdex = await TDEX.deployed();
        value = user[1].ttc_num.mul(million.add(takerFeeRate)).div(million);
        await tdex.addBuyTokenOrder( user[1].price,{from:user[1].addr, to:tdex.address, value:value}).then(function(info){
            assert.equal(info.logs[0].event, "TE", "equal");
            assert.equal(info.logs[0].args.t, 1, "equal");
            assert.equal(info.logs[0].args.addr, user[1].addr, "equal");
            assert.equal(info.logs[0].args.amount.toString(10), user[1].num.toString(10), "equal");
            assert.equal(info.logs[0].args.price.toString(10), user[1].price.toString(10) , "equal");
            assert.equal(info.logs[0].args.sign, false , "equal");

            user[1].index = info.logs[0].args.index;
            user[1].order_id = info.logs[0].args.orderID;
        });

        isBuy = true;
        await tdex.adminCancelOrder(isBuy,user[1].order_id, user[1].index, {from:owner}).then(function(info){
            assert.equal(info.logs[0].event, "TE", "equal");
            assert.equal(info.logs[0].args.t, 5, "equal");
            assert.equal(info.logs[0].args.addr, user[1].addr, "equal");
            assert.equal(info.logs[0].args.amount.toString(10), user[1].num.toString(10), "equal");
            assert.equal(info.logs[0].args.price.toString(10), user[1].price.toString(10) , "equal");
            assert.equal(info.logs[0].args.sign, true , "equal");

        });

    });


    it("re-add sell order to tdex && cancel order by admin",  async () =>  {
        const tdex = await TDEX.deployed();

        await tdex.addSellTokenOrder(user[3].num, user[3].price,{from:user[3].addr}).then(function(info){
            assert.equal(info.logs[0].event, "TE", "equal");
            assert.equal(info.logs[0].args.t, 2, "equal");
            assert.equal(info.logs[0].args.addr, user[3].addr, "equal");
            assert.equal(info.logs[0].args.amount.toString(10), user[3].num.toString(10), "equal");
            assert.equal(info.logs[0].args.price.toString(10), user[3].price.toString(10) , "equal");
            assert.equal(info.logs[0].args.sign, false , "equal");

            user[3].index = info.logs[0].args.index;
            user[3].order_id = info.logs[0].args.orderID;
        });

        isBuy = false;
        await tdex.adminCancelOrder(isBuy,user[3].order_id, user[3].index, {from:owner}).then(function(info){
            assert.equal(info.logs[0].event, "TE", "equal");
            assert.equal(info.logs[0].args.t, 6, "equal");
            assert.equal(info.logs[0].args.addr, user[3].addr, "equal");
            assert.equal(info.logs[0].args.amount.toString(10), user[3].num.toString(10), "equal");
            assert.equal(info.logs[0].args.price.toString(10), user[3].price.toString(10) , "equal");
            assert.equal(info.logs[0].args.sign, true , "equal");
        });

    });


    it("complicated trade",  async () =>  {
        // reset user data, user1 to user4
        users_init_data = [{"type":false,"num":200,"price":0.011},  
            {"type":true,"num":600,"price":0.012},
            {"type":false,"num":300,"price":0.012},
            {"type":false,"num":200,"price":0.01}];
        user = {};            
        for (k in users_init_data) {
            var u = users_init_data[k];
            k = parseInt(k) + 1;
            user[k] = ({"addr":eth.accounts[k],
                    "type":u.type,
                    "num":decimal.mul(u.num),
                    "price":decimal.mul(u.price).floor(),
                    "ttc_num":decimal.mul(u.num).mul(u.price).floor(),
            })
        }    

        const tdex = await TDEX.deployed();
        const token = await TOKEN.deployed();
        
        // token transfer and approve 
        for (i=1;i<5;i++) {
            if (!user[i].type){
                await token.transfer(user[i].addr,user[i].num*20, {from:owner});
                await token.approve(tdex.address,0, {from:user[1].addr});
                await token.approve(tdex.address,user[1].num*20, {from:user[1].addr});
            }
        }

        await tdex.addSellTokenOrder(user[1].num, user[1].price,{from:user[1].addr}).then(function(info){
            assert.equal(info.logs[0].event, "TE", "equal");
            assert.equal(info.logs[0].args.t, 2, "equal");
            assert.equal(info.logs[0].args.addr, user[1].addr, "equal");
            assert.equal(info.logs[0].args.amount.toString(10), user[1].num.toString(10), "equal");
            assert.equal(info.logs[0].args.price.toString(10), user[1].price.toString(10) , "equal");
            assert.equal(info.logs[0].args.sign, false , "equal");

            user[1].index = info.logs[0].args.index;
            user[1].order_id = info.logs[0].args.orderID;
        });

        await tdex.executeOrder({from:executer}).then(function(info){
            //printLogs(info.logs);

            //assert.equal(info.logs.length <= 4, true, "equal"); // no refund & no collect trade fee
            //assert.equal(info.logs[2].event, "TE", "equal");
            //assert.equal(info.logs[2].args.t, 7, "equal");
            //assert.equal(info.logs[2].args.addr, user[6].addr, "equal");
            //refund = info.logs[2].args.amount.mul(info.logs[2].args.price);
            //assert.equal(info.logs[0].args.sign, false, "equal");

        });
     
        value =user[2].ttc_num.mul(million.add(takerFeeRate)).div(million)
        await tdex.addBuyTokenOrder(user[2].price,{from:user[2].addr, to:tdex.address, value:value}).then(function(info){
            assert.equal(info.logs[0].event, "TE", "equal");
            assert.equal(info.logs[0].args.t, 1, "equal");
            assert.equal(info.logs[0].args.addr, user[2].addr, "equal");
            assert.equal(info.logs[0].args.amount.toString(10), user[2].num.toString(10), "equal");
            assert.equal(info.logs[0].args.price.toString(10), user[2].price.toString(10) , "equal");
            assert.equal(info.logs[0].args.sign, false , "equal");

            user[2].index = info.logs[0].args.index;
            user[2].order_id = info.logs[0].args.orderID;
        });

        await tdex.executeOrder({from:executer}).then(function(info){
            //printLogs(info.logs);

            //assert.equal(info.logs.length <= 4, true, "equal"); // no refund & no collect trade fee
            //assert.equal(info.logs[2].event, "TE", "equal");
            //assert.equal(info.logs[2].args.t, 7, "equal");
            //assert.equal(info.logs[2].args.addr, user[6].addr, "equal");
            //refund = info.logs[2].args.amount.mul(info.logs[2].args.price);
            //assert.equal(info.logs[0].args.sign, false, "equal");

        });
               
        await tdex.addSellTokenOrder(user[3].num, user[3].price,{from:user[3].addr}).then(function(info){
            assert.equal(info.logs[0].event, "TE", "equal");
            assert.equal(info.logs[0].args.t, 2, "equal");
            assert.equal(info.logs[0].args.addr, user[3].addr, "equal");
            assert.equal(info.logs[0].args.amount.toString(10), user[3].num.toString(10), "equal");
            assert.equal(info.logs[0].args.price.toString(10), user[3].price.toString(10) , "equal");
            assert.equal(info.logs[0].args.sign, false , "equal");

            user[3].index = info.logs[0].args.index;
            user[3].order_id = info.logs[0].args.orderID;
        });
       
        await tdex.executeOrder({from:executer}).then(function(info){
            //printLogs(info.logs);

            //assert.equal(info.logs.length <= 4, true, "equal"); // no refund & no collect trade fee
            //assert.equal(info.logs[2].event, "TE", "equal");
            //assert.equal(info.logs[2].args.t, 7, "equal");
            //assert.equal(info.logs[2].args.addr, user[6].addr, "equal");
            //refund = info.logs[2].args.amount.mul(info.logs[2].args.price);
            //assert.equal(info.logs[0].args.sign, false, "equal");

        });
               
        await tdex.addSellTokenOrder(user[4].num, user[4].price,{from:user[4].addr}).then(function(info){
            assert.equal(info.logs[0].event, "TE", "equal");
            assert.equal(info.logs[0].args.t, 2, "equal");
            assert.equal(info.logs[0].args.addr, user[4].addr, "equal");
            assert.equal(info.logs[0].args.amount.toString(10), user[4].num.toString(10), "equal");
            assert.equal(info.logs[0].args.price.toString(10), user[4].price.toString(10) , "equal");
            assert.equal(info.logs[0].args.sign, false , "equal");

            user[4].index = info.logs[0].args.index;
            user[4].order_id = info.logs[0].args.orderID;
        });

        await tdex.executeOrder({from:executer}).then(function(info){
            //printLogs(info.logs);

            //assert.equal(info.logs.length <= 4, true, "equal"); // no refund & no collect trade fee
            //assert.equal(info.logs[2].event, "TE", "equal");
            //assert.equal(info.logs[2].args.t, 7, "equal");
            //assert.equal(info.logs[2].args.addr, user[6].addr, "equal");
            //refund = info.logs[2].args.amount.mul(info.logs[2].args.price);
            //assert.equal(info.logs[0].args.sign, false, "equal");

        });
        

    });
    // the follow test case should be final test case 
    it("withdraw all from contract",  async () =>  {
        const tdex = await TDEX.deployed();
        const token = await TOKEN.deployed();

        ttc_before = await web3.eth.getBalance(adminWithdrawAddress);
        token_before = await token.balanceOf.call(adminWithdrawAddress);
        contract_ttc_before = await web3.eth.getBalance(tdex.address);
        contract_token_before = await token.balanceOf.call(tdex.address);
        gas_used = 0;
        gas_price = new web3.BigNumber(1000000);
        res = await tdex.withdrawTTC({from:owner,gasPrice:gas_price});
        gas_used = res.receipt.gasUsed;
        
        ttc_after = await web3.eth.getBalance(adminWithdrawAddress);
        contract_ttc_after = await web3.eth.getBalance(tdex.address);
        res = await tdex.withdrawToken({from:owner,gasPrice:gas_price});

        gas_v = gas_price.mul(gas_used);

        token_after = await token.balanceOf.call(adminWithdrawAddress);
        contract_token_after = await token.balanceOf.call(tdex.address);

        assert.equal(contract_token_before.toNumber() > 0, true, "equal");
        assert.equal(contract_ttc_before.toNumber() > 0, true, "equal");
        assert.equal(contract_token_after.toNumber() == 0, true, "equal");
        assert.equal(contract_ttc_after.toNumber() == 0, true, "equal");
        assert.equal(token_before.add(contract_token_before).toString(10),
                    token_after.add(contract_token_after).toString(10),
                    "equal");
        assert.equal(ttc_before.add(contract_ttc_before).toString(10),
                    ttc_after.add(contract_ttc_after).toString(10),
                    "equal");
    });

});
