const seed = process.env.SEED || 'myth like bonus scare over problem client lizard pioneer submit female collect';
const HDWalletProvider = require('@truffle/hdwallet-provider');

const networks = Object.assign(...[
  [1, 'mainnet'],
  [3, 'ropsten'],
  [4, 'rinkeby'],
  [5, 'goerli', `${2e9}`],
  [42, 'kovan'],
].map(([networkId, network, gasPrice]) => ({
  [network]: {
    network_id: networkId,
    gasPrice,
    provider: () => new HDWalletProvider(
      seed,
      `https://${network}.infura.io/v3/17d5bb5953564f589d48d535f573e486`,
    ),
  },
})), {
  development: {
    host: 'localhost',
    port: 8545,
    network_id: '*',
  },
});

module.exports = { networks };
