# polymarket-subgraph

1. Make changes to mappings, etc.
2. Run `export ACCESS_TOKEN=<ACCESS_TOKEN>`.
3. Run `graph auth https://api.thegraph.com/deploy/ <ACCESS_TOKEN>`.
4. Use command line to deploy by running `yarn publish-graph:OPTION` where OPTION is the subgraph being deployed. See the `package.json`.

:tada: Celebrate graph deployment or debug deployment.

---

### Local Testing

1. Make code changes.
2. Add your RPC to the ethereum line of docker-compose.yml as`ethereum: "matic:<RPC_URL>"`
3. Run `yarn prepare:matic` if prepping/testing with matic.
4. Run docker, then `docker-compose up`
5. Local node should be indexing events.
6. Run `yarn create-local` and `yarn deploy-local` to deploy to running docker process.
7. Access The GraphiQL interface at http://localhost:8000/subgraphs/id/COPY_ID_FROM_DEPLOY_STEP
