module.exports = function(deployer) {
  deployer.deploy(artifacts.require('Migrations'));
};
