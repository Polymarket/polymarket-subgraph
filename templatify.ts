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
    'fee-module-subgraph/subgraph.yaml',
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

  // Accept the network as either the first positional argument or the
  // NETWORK_NAME environment variable.
  //
  // Only `process.argv[2]` was read before, while the error message told the
  // user to set NETWORK_NAME. That mismatch was not cosmetic: the
  // `prepare:mainnet`, `prepare:matic` and `prepare:mumbai` package scripts pass
  // the network via `NETWORK_NAME=...` and no argument at all, so all three
  // always threw before generating anything. Only `templatify:matic`, which
  // passes the network positionally, worked.
  const networkName = process.argv[2] || process.env.NETWORK_NAME;

  // Validation happens before `networks[networkName]` is read. The previous
  // order dereferenced the lookup on the line above the guard, so it ran with
  // `networks['']`, and the `SUBGRAPH` half of the message referred to a
  // variable this script has never read (see the commented-out
  // getNetworkNameForSubgraph above, which is where that came from).
  if (!networkName) {
    throw new Error(
      'Please pass the network as the first argument (e.g. `ts-node ./templatify.ts matic`) ' +
        'or set the "NETWORK_NAME" environment variable.',
    );
  }

  // An unknown key used to yield `{...undefined}`, i.e. an empty context, and
  // Handlebars renders a missing value as the empty string. That produced a
  // syntactically valid subgraph.yaml with blank contract addresses and
  // `startBlock:` unset -- a manifest that deploys and then indexes nothing,
  // which is far more expensive to diagnose than a failed generate.
  if (!networks[networkName]) {
    throw new Error(
      `Unknown network "${networkName}". networks.yaml defines: ${Object.keys(
        networks,
      ).join(', ')}.`,
    );
  }

  console.log(`Network: ${networkName}`);
  const network = { ...networks[networkName], networkName };

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
