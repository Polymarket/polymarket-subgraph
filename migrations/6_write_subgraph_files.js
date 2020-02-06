const fs = require('fs-extra');
const mustache = require('mustache');

module.exports = function(deployer, network) {
  deployer.then(async () => {
    const templateData = { network };

    for(const contractName of [
      'FPMMDeterministicFactory',
      'FixedProductMarketMaker',
      'ConditionalTokens',
    ]) {
      const { abi } = fs.readJsonSync(`build/contracts/${contractName}.json`);
      fs.outputJsonSync(`abis/${contractName}.json`, abi, { spaces: 2 });

      const C = artifacts.require(contractName);
      try {
        const { address } = C;
        templateData[contractName] = {
          address,
          addressLowerCase: address.toLowerCase(),
          startBlock: (
            await web3.eth.getTransactionReceipt(C.transactionHash)
          ).blockNumber,
        };
      } catch (e) {}
    }

    for (const templatedFileDesc of [
      ['subgraph', 'yaml'],
      ['src/FPMMDeterministicFactoryMapping', 'ts'],
    ]) {
      const template = fs.readFileSync(`${templatedFileDesc[0]}.template.${templatedFileDesc[1]}`).toString();
      fs.writeFileSync(
        `${templatedFileDesc[0]}.${templatedFileDesc[1]}`,
        mustache.render(template, templateData),
      );
    }
  })
};
