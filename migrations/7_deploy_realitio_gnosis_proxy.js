module.exports = function(deployer) {
  deployer.deploy(
    artifacts.require('RealitioProxy'),
    artifacts.require('ConditionalTokens').address,
    artifacts.require('Realitio').address,
    5,
  );
};
