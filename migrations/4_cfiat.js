var CFIAT = artifacts.require("./CFIAT.sol");

module.exports = function(deployer) {
  deployer.deploy(CFIAT);
};

