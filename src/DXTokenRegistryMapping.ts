import { AddToken, RemoveToken } from '../generated/DXTokenRegistry/DXTokenRegistry'
import { TokenRegistry } from '../generated/schema'

export function handleAddToken(event: AddToken): void {
  const id = event.params.listId.toHex()

  if(id == '4') {
    let tcr = TokenRegistry.load(id)

    if(tcr != null) {
      tcr = new TokenRegistry(id)
      tcr.markets = []
    }

    tcr.markets.push(event.params.token.toHex())
    tcr.save()
  }
}

export function handleRemoveToken(event: RemoveToken): void {
  const id = event.params.listId.toHex()

  if(id == '4') {
    let tcr = TokenRegistry.load(id)

    if(tcr != null) {
      tcr.markets = tcr.markets.filter(token => token != event.params.token.toHex())
      tcr.save()
    }
  }
}