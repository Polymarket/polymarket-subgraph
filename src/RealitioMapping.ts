import { log } from '@graphprotocol/graph-ts'

import {
  LogNewQuestion,
  LogNewAnswer,
  LogNotifyOfArbitrationRequest,
  LogFinalize,
} from '../generated/Realitio/Realitio'
import { Question } from '../generated/schema'

enum UnescapeState {
  Normal,
  Escaped,
  ReadingHex1,
  ReadingHex2,
  ReadingHex3,
  ReadingHex4,
}

function unescape(input: string): string {
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

export function handleNewQuestion(event: LogNewQuestion): void {
  let questionId = event.params.question_id.toHexString();
  let question = new Question(questionId);

  if (event.params.template_id.toI32() != 2) {
    log.info('ignoring question {} with template ID {}', [
      questionId,
      event.params.template_id.toString(),
    ]);
    return;
  }

  let data = event.params.question;
  question.data = data;

  let fields = data.split('\u241f', 4);

  if (fields.length >= 1) {
    question.title = unescape(fields[0]);
    if (fields.length >= 2) {
      let outcomesData = fields[1];
      let start = -1;
      let escaped = false
      let outcomes = new Array<string>(0);
      for (let i = 0; i < outcomesData.length; i++) {
        if (escaped) {
          escaped = false;
        } else {
          if (outcomesData[i] == '"') {
            if (start == -1) {
              start = i + 1;
            } else {
              outcomes.push(unescape(outcomesData.slice(start, i)));
              start = -1;
            }
          } else if (outcomesData[i] == '\\') {
            escaped = true;
          }
        }
      }
      question.outcomes = outcomes;
      if (fields.length >= 3) {
        question.category = unescape(fields[2]);
        if (fields.length >= 4) {
          question.language = unescape(fields[3]);
        }
      }
    }
  }
  question.arbitrator = event.params.arbitrator;
  question.openingTimestamp = event.params.opening_ts;
  question.timeout = event.params.timeout;

  question.isPendingArbitration = false;

  question.save();
}

export function handleNewAnswer(event: LogNewAnswer): void {
  let questionId = event.params.question_id.toHexString()
  let question = Question.load(questionId);
  if (question == null) {
    log.info('cannot find question {} to answer', [questionId]);
    return;
  }

  // only record confirmed answers
  if (!event.params.is_commitment) {
    question.currentAnswer = event.params.answer;
    question.currentAnswerBond = event.params.bond;
    question.currentAnswerTimestamp = event.params.ts;
  }

  question.save();
}

export function handleArbitrationRequest(event: LogNotifyOfArbitrationRequest): void {
  let questionId = event.params.question_id.toHexString()
  let question = Question.load(questionId);
  if (question == null) {
    log.info('cannot find question {} to begin arbitration', [questionId]);
    return;
  }

  question.isPendingArbitration = true;

  question.save();
}

export function handleFinalize(event: LogFinalize): void {
  let questionId = event.params.question_id.toHexString()
  let question = Question.load(questionId);
  if (question == null) {
    log.info('cannot find question {} to finalize', [questionId]);
    return;
  }

  question.isPendingArbitration = false;

  question.save();
}
