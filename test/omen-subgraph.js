const Web3 = require('web3');
const TruffleContract = require("@truffle/contract");
const { default: axios } = require('axios');
const delay = require('delay');
const fs = require('fs-extra');
const path = require('path');
const should = require('should')

const provider = new Web3.providers.HttpProvider("http://localhost:8545");

function getContract(contractName) {
  const C = TruffleContract(fs.readJsonSync(path.join(
    __dirname, '..', 'build', 'contracts', `${contractName}.json`
  )));
  C.setProvider(provider);
  return C;
}

const FPMMDeterministicFactory = getContract('FPMMDeterministicFactory');

describe('Omen subgraph', function() {
  let factory;
  before('get FPMM factory', async function() {
    factory = await FPMMDeterministicFactory.deployed();
  });

  it('exists', async function() {
    const { subgraphs } = (await axios.post('http://localhost:8000/subgraphs', { 
      query: `{
        subgraphs(first: 1, where: {name: "cag/omen"}) {
          id
        }
      }`
    })).data.data;

    subgraphs.should.be.not.empty();
  });
});
