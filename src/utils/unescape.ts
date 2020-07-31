import { log } from '@graphprotocol/graph-ts'

enum UnescapeState {
  Normal,
  Escaped,
  ReadingHex1,
  ReadingHex2,
  ReadingHex3,
  ReadingHex4,
}

export function unescape(input: string): string {
  let output = '';
  let i = 0;
  let state = UnescapeState.Normal;
  let escapedCodeUnitBuffer = 0;
  for (let i = 0; i < input.length; i++) {
    let codeUnit = input.charCodeAt(i);

    if (state == UnescapeState.Normal) {
      if (codeUnit == 0x5c) {
        // \
        state = UnescapeState.Escaped
      } else {
        output += String.fromCharCode(codeUnit);
      }
    } else if (state == UnescapeState.Escaped) {
      if (codeUnit == 0x75) {
        // %x75 4HEXDIG )  ; uXXXX                U+XXXX
        state = UnescapeState.ReadingHex1;
      } else {
        if (codeUnit == 0x62) {
          // %x62 /          ; b    backspace       U+0008
          output += '\b';
        } else if (codeUnit == 0x66) {
          // %x66 /          ; f    form feed       U+000C
          output += '\f';
        } else if (codeUnit == 0x6e) {
          // %x6E /          ; n    line feed       U+000A
          output += '\n';
        } else if (codeUnit == 0x72) {
          // %x72 /          ; r    carriage return U+000D
          output += '\r';
        } else if (codeUnit == 0x74) {
          // %x74 /          ; t    tab             U+0009
          output += '\t';
        } else if (
          codeUnit == 0x22 ||
          codeUnit == 0x5c || 
          codeUnit == 0x2f
        ) {
          output += String.fromCharCode(codeUnit);
        } else {
          let badEscCode = String.fromCharCode(codeUnit);
          log.warning('got invalid escape code \\{} in position {} while unescaping "{}"', [
            badEscCode,
            i.toString(),
            input,
          ]);
          output += '�';
        }
        state = UnescapeState.Normal;
      }
    } else {
      // reading hex characters here
      let nibble = 0;
      if (codeUnit >= 48 && codeUnit < 58) {
        // 0-9
        nibble = codeUnit - 48;
      } else if (codeUnit >= 65 && codeUnit < 71) {
        // A-F
        nibble = codeUnit - 55;
      } else if (codeUnit >= 97 && codeUnit < 103) {
        // a-f
        nibble = codeUnit - 87;
      } else {
        nibble = -1;
      }
      
      if (nibble < 0) {
        log.warning('got invalid hex character {} in position {} while unescaping "{}"', [
          String.fromCharCode(codeUnit),
          i.toString(),
          input,
        ]);
        output += '�';
        state = UnescapeState.Normal;
      } else {
        if (state == UnescapeState.ReadingHex1) {
          escapedCodeUnitBuffer |= nibble << 12;
          state = UnescapeState.ReadingHex2;
        } else if (state == UnescapeState.ReadingHex2) {
          escapedCodeUnitBuffer |= nibble << 8;
          state = UnescapeState.ReadingHex3;
        } else if (state == UnescapeState.ReadingHex3) {
          escapedCodeUnitBuffer |= nibble << 4;
          state = UnescapeState.ReadingHex4;
        } else if (state == UnescapeState.ReadingHex4) {
          output += String.fromCharCode(escapedCodeUnitBuffer | nibble);
          escapedCodeUnitBuffer = 0;
          state = UnescapeState.Normal;
        }
      }
    }
  }

  return output;
}
