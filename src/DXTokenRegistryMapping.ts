import { AddToken, RemoveToken } from '../generated/DXTokenRegistry/DXTokenRegistry'
import { TokenRegistry } from '../generated/schema'

export function handleAddToken(event: AddToken): void {
  const id = event.params.listId

  if(id.toI32() == 4) {
    let idHex = id.toHex()
    let tcr = TokenRegistry.load(idHex)

    if(tcr != null) {
      tcr = new TokenRegistry(idHex)
      tcr.markets = []
    }

    tcr.markets.push(event.params.token.toHex())
    tcr.save()
  }
}

export function handleRemoveToken(event: RemoveToken): void {
  const id = event.params.listId

  if(id.toI32() == 4) {
    let idHex = id.toHex()
    let tcr = TokenRegistry.load(idHex)

    if(tcr != null) {
      tcr.markets = tcr.markets.filter(token => token != event.params.token.toHex())
      tcr.save()
    }
  }
}