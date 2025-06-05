import * as yaml from 'js-yaml';
import * as Handlebars from 'handlebars';
import * as fs from 'fs-extra';
import * as path from 'path';

const config = {
  templatedFiles: [
    'activity-subgraph/subgraph.yaml',
    'pnl-subgraph/subgraph.yaml',
    'oi-subgraph/subgraph.yaml',
    'fpmm-subgraph/subgraph.yaml',
    'orderbook-subgraph/subgraph.yaml',
    'sports-oracle-subgraph/subgraph.yaml',
    'wallet-subgraph/subgraph.yaml',
    'common/constants.ts',
  ],
};

Handlebars.registerHelper('lowercase', function (str) {
  if (str && typeof str == 'string') {
    return str.toLowerCase();
  }
  return '';
});

// function getNetworkNameForSubgraph(): string | null {
//   switch (process.env.SUBGRAPH) {
//     case 'tomafrench/polymarket':
//       return 'mainnet';
//     case 'Polymarket/polymarket':
//       return 'mainnet';
//     case 'Polymarket/polymarket-matic':
//       return 'matic';
//     case 'Polymarket/polymarket-mumbai':
//       return 'mumbai';
//     default:
//       return null;
//   }
// }

(async (): Promise<void> => {
  console.log('Starting...');
  const networksFilePath = path.join(__dirname, 'networks.yaml');
  const networks: any = yaml.load(
    await fs.readFile(networksFilePath, { encoding: 'utf-8' }),
  );

  const networkName = process.argv[2];
  console.log(`Network: ${networkName}`);
  const network = { ...networks[networkName || ''], networkName };

  if (!networkName) {
    throw new Error(
      'Please set either a "NETWORK_NAME" or a "SUBGRAPH" environment variable',
    );
  }

  // eslint-disable-next-line no-restricted-syntax
  for (const templatedFile of config.templatedFiles) {
    console.log(templatedFile);
    const templatedFileDesc = templatedFile.split('.');
    const template = fs
      .readFileSync(`${templatedFileDesc[0]}.template.${templatedFileDesc[1]}`)
      .toString();
    const result = Handlebars.compile(template, {})(network);
    fs.writeFileSync(`${templatedFileDesc[0]}.${templatedFileDesc[1]}`, result);
  }

  console.log(`🎉 subgraph successfully generated for ${networkName}\n`);
})();
