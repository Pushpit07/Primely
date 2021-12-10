const PrimelyMarketContract = artifacts.require("PrimelyMarketContract");

module.exports = function (deployer) {
	deployer.deploy(PrimelyMarketContract);
};
