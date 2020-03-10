import { log } from '@graphprotocol/graph-ts'

import {
  LogNewQuestion,
  LogNewAnswer,
  LogNotifyOfArbitrationRequest,
  LogFinalize,
} from '../generated/Realitio/Realitio'
import { Question } from '../generated/schema'

import { unescape } from './unescape'

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
