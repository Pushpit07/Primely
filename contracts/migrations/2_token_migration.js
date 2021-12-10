const PrimelyToken = artifacts.require("PrimelyToken");

module.exports = function (deployer) {
	deployer.deploy(PrimelyToken);
};
