module.exports = function(deployer) {
  deployer.deploy(artifacts.require('Realitio'));
  deployer.deploy(artifacts.require('Arbitrator'));
};
