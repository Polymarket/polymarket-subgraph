const fs = require('fs-extra');
const mustache = require('mustache');

module.exports = function(deployer, network) {
  for(const contractName of ['FPMMDeterministicFactory', 'FixedProductMarketMaker']) {
    const { abi } = fs.readJsonSync(`build/contracts/${contractName}.json`);
    fs.outputJsonSync(`abis/${contractName}.json`, abi, { spaces: 2 });
  }

  const template = fs.readFileSync('subgraph.template.yaml').toString();
  fs.writeFileSync('subgraph.yaml', mustache.render(template, {
    network,
    FPMMDeterministicFactory: {
      address: artifacts.require('FPMMDeterministicFactory').address,
      startBlock: 0,
    }
  }));
};
