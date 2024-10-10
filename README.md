# Polymarket Subgraph

## Published Versions on The Graph Network

- [Polymarket Subgraph](https://thegraph.com/explorer/subgraphs/81Dm16JjuFSrqz813HysXoUPvzTwE7fsfPk2RTf66nyC?view=Query&chain=arbitrum-one)
- [Polymarket Profit and Loss (PnL)](https://thegraph.com/explorer/subgraphs/6c58N5U4MtQE2Y8njfVrrAfRykzfqajMGeTMEvMmskVz?view=Query&chain=arbitrum-one)
- [Polymarket Activity](https://thegraph.com/explorer/subgraphs/Bx1W4S7kDVxs9gC3s2G6DS8kdNBJNVhMviCtin2DiBp?view=Query&chain=arbitrum-one)
- [Polymarket Open Interest](https://thegraph.com/explorer/subgraphs/ELaW6RtkbmYNmMMU6hEPsghG9Ko3EXSmiRkH855M4qfF?view=Query&chain=arbitrum-one)

## Development

### Preparing `subgraph.yaml`

This repo contains multiple subgraphs, pnl-subgraph, activity-subgraph, and market-subgraph. Each subgraph has dedicated yarn scripts for convenience.

First, to prepare `subgraph.yaml` and other templated files, run `yarn templatify:matic`.

It's recommended to run the codegen command for the subgraph you're working on, as it will only generate the types and schemas for that subgraph. To do this, run `yarn pnl:codegen`, `yarn activity:codegen`, `yarn oi:codegen` or `yarn polymarket:codegen`.

### Deploy to Goldsky

Build the subgraph with `yarn <subgraph>:build`, and deploy with:

```bash
goldsky subgraph deploy <subgraph-name>/<version> --path ./build/
```

### Deploy to Subgraph Studio

After subgraphs are built, deploy to [Subgraph Studio](https://thegraph.com/studio/):

```
yarn activity:deploy-graph
yarn pnl:deploy-graph
yarn oi:deploy-graph
yarn polymarket:deploy-graph
```

### Run Graph Node locally

Create a `.env` file with the following variables:

```bash
MATIC_RPC_URL=
```

Here, `MATIC_RPC_URL` should be your RPC URL for the Polygon network. Common providers include Alchemy and Infura.

### Running the test suite

Run `yarn test` to run the test suite, which will run in a docker container.

### Local Deployment

To start the docker environment, run `docker compose up`. Once the environment is ready, create and deploy the subgraph:

```[bash]
yarn <subgraph>:create-local
yarn <subgraph>:deploy-local
```

Access the GraphQL editor at:

[`http://localhost:8000/subgraphs/name/polymarket-subgraph/graphql`](http://localhost:8000/subgraphs/name/polymarket-subgraph/graphql)

**Example query:**

```graphQL
query tokenIdConditions {
  tokenIdConditions {
    id
    condition
    complement
  }
}
```

### Restart graph node and clear volumes

```bash
docker compose down
```

```bash
sudo docker rm polymarket-subgraph-graph-node-1 && sudo docker rm polymarket-subgraph-ipfs-1 && sudo docker rm polymarket-subgraph-postgres-1 && sudo docker rm polymarket-subgraph-ganache-1
```

The names of you docker containers may vary; check the terminal.

### Running on an M1 Chip

To run locally on an M1 chip, you'll need to build a local copy of the graph-node docker image. To do this, clone the [graph-node repo](https://github.com/graphprotocol/graph-node) and run the following commands:

```bash
# Remove the original image
docker rmi graphprotocol/graph-node:latest

# Build the image
./docker/build.sh

# Tag the newly created image
docker tag graph-node graphprotocol/graph-node:latest
```

Note: you likely will have to increase your Docker daemon memory capacity. In Docker desktop you can find this setting under Preferences > Resources > Advanced.

## Contracts

These subgraphs track contracts from the following repositories:

[https://github.com/gnosis/conditional-tokens-contracts]

[https://github.com/gnosis/conditional-tokens-market-makers]

[https://github.com/Polymarket/ctf-exchange]

[https://github.com/Polymarket/neg-risk-ctf-adapter]
