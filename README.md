# polymarket-subgraph

## Environment Variables

Create a `.env` file with the following variables:

```bash
MATIC_RPC_URL=
```

## Preparing `subgraph.yaml`

Export an environment variable with `NETWORK_NAME` either 'matic' or 'mumbai'.
To prepare the `subgraph.yaml` file, modify `networks.json` as appropriate and run

```bash
yarn prepare:$NETWORK
```

## Local Deployment

```bash
docker compose up
```

## Restart graph node and clear volumes

```bash
docker compose down
```

```bash
sudo docker rm polymarket-subgraph_graph-node_1 && sudo docker rm polymarket-subgraph_ipfs_1 && sudo docker rm polymarket-subgraph_postgres_1 && sudo docker rm polymarket-subgraph_ganache_1
```

## Create and deploy subgraph

While local subgraph node is running run:

```bash
yarn create-local
```

```bash
yarn deploy-local
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

## Goldsky

Build the subgraph with `yarn build`, and deploy with:

```bash
goldsky subgraph deploy polymarket-subgraph/<version> --path .
```

## Running on an M1 Chip

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
