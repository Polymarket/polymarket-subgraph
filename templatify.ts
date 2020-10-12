import yaml = require('js-yaml');

import Handlebars = require('handlebars');
import fs = require('fs-extra');
import path = require('path');

import typy = require('typy');

Handlebars.registerHelper('lowercase', function (str) {
  if(str && typeof str === "string") {
    return str.toLowerCase();
  }
  return '';
});

function getNetworkNameForSubgraph(): string | null {
  switch (process.env.SUBGRAPH) {
    case undefined:
    case 'tomafrench/polymarket':
      return 'mainnet';
    case 'TokenUnion/polymarket':
      return 'mainnet';
    default:
      return null;
  }
}

(async (): Promise<void> => {
  const networksFilePath = path.join(__dirname, 'networks.yaml');
  const networks = yaml.load(
    await fs.readFile(networksFilePath, { encoding: 'utf-8' }),
  );

  const networkName = process.env.NETWORK_NAME || getNetworkNameForSubgraph();
  const network = typy.t(networks, networkName || '').safeObject;
  if (typy.t(network).isFalsy) {
    throw new Error(
      'Please set either a "NETWORK_NAME" or a "SUBGRAPH" environment variable',
    );
  }

  for (const templatedFileDesc of [
    ['subgraph', 'yaml'],
    ['src/FixedProductMarketMakerFactoryMapping', 'ts'],
  ]) {
    const template = fs.readFileSync(`${templatedFileDesc[0]}.template.${templatedFileDesc[1]}`).toString();
    fs.writeFileSync(
      `${templatedFileDesc[0]}.${templatedFileDesc[1]}`,
      Handlebars.compile(template)(network),
    );
  }

  console.log('🎉 subgraph successfully generated\n');

})();
