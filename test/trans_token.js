var TransToken = artifacts.require("./TransToken.sol");
var TOKEN;
var targetToken = 'CLAY';
if (targetToken == 'CLAY') {
    TOKEN = artifacts.require("./CLAY.sol");
}else if (targetToken == 'CFIAT') {
    TOKEN = artifacts.require("./CFIAT.sol");
}

contract('TransToken', function() {
    var eth = web3.eth;
    var owner = eth.accounts[0];
    var collect = eth.accounts[1];
    var user2 = eth.accounts[2];
    var user3 = eth.accounts[3];
    var decimal = new web3.BigNumber('1000000000000000000');  // 10**18
    var minTransValue = new web3.BigNumber('1000000000000000000');  // 10**18
    var transFee = new web3.BigNumber('20000000000000000000');  // 20*10**18
      
	function getBalance(addr){
        return web3.fromWei(web3.eth.getBalance(addr), "ether");
	}

	function printBalance() {
        var balance = web3.eth.getBalance(owner);
        console.log("Owner balance", web3.fromWei(balance, "ether").toString(), " ETHER");
    }

  	it("start ",function(){
    	return TransToken.deployed().then(function(content){
      		printBalance();
    	});
  	});

    it("update info ",async () => {
        const tt = await TransToken.deployed();
        minTransValue = await tt.minTransValue.call();
        transFee = await tt.transFee.call();
    });

    it("add token for tt",  async () =>  {
        const tt = await TransToken.deployed();
        const token = await TOKEN.deployed();
        await tt.initAddressSettings(1,collect, {from:owner});
        await tt.initAddressSettings(2,token.address, {from:owner});
        token_address = await tt.MyToken.call();
        assert.equal(token_address, token.address, "equal");
        collect_address = await tt.adminWithdrawAddress.call();
        assert.equal(collect_address, collect, "equal");
        
    });


    it("transfer token to user2 and user3",  async () =>  {
        //const tt = await tt.deployed();
        const token = await TOKEN.deployed();
        const tt = await TransToken.deployed();


        await token.transfer(user2, decimal.mul(2000), {from:owner});
        await token.transfer(user3, decimal.mul(3000), {from:owner});
        
        user2_token_balance = await token.balanceOf.call(user2);
        assert.equal(user2_token_balance.toString(10), decimal.mul(2000).toString(10), "equal");

        user3_token_balance = await token.balanceOf.call(user3);
        assert.equal(user3_token_balance.toString(10), decimal.mul(3000).toString(10), "equal");

        await token.approve(tt.address,user2_token_balance, {from:user2});
        await token.approve(tt.address,user3_token_balance, {from:user3});
        
    });


    it("user2 transfer token user3",  async () =>  {
        const tt = await TransToken.deployed();
        const token = await TOKEN.deployed();

        await tt.transferToken(user3, decimal.mul(100),{from:user2}).then(function(info){
            assert.equal(info.logs[0].event, "TT", "equal");
            assert.equal(info.logs[0].args.t, 1, "equal");
            assert.equal(info.logs[0].args.addrFrom, user2, "equal");
            assert.equal(info.logs[0].args.addrTo, user3, "equal");
            assert.equal(info.logs[0].args.amount.toString(10), decimal.mul(100).toString(10), "equal");
            assert.equal(info.logs[0].args.fee.toString(10), transFee.toString(10) , "equal");
        });


        user2_token_balance = await token.balanceOf.call(user2);
        assert.equal(user2_token_balance.toString(10), decimal.mul(1900).sub(transFee).toString(10), "equal");

        user3_token_balance = await token.balanceOf.call(user3);
        assert.equal(user3_token_balance.toString(10), decimal.mul(3100).toString(10), "equal");
        
    });

});
