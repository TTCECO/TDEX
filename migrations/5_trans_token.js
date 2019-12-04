var TransToken = artifacts.require("./TransToken.sol");

module.exports = function(deployer) {
  deployer.deploy(TransToken);
};

