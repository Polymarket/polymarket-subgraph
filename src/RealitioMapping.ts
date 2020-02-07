import { log } from '@graphprotocol/graph-ts'

import {
  LogNewQuestion,
  LogNewTemplate,
  LogNewAnswer,
  LogAnswerReveal,
  LogNotifyOfArbitrationRequest,
  LogFinalize,
} from '../generated/Realitio/Realitio'
import { Question, QuestionTemplate } from '../generated/schema'

export function handleNewTemplate(event: LogNewTemplate): void {
  let template = new QuestionTemplate(event.params.template_id.toHexString());
  template.template = event.params.question_text;
  template.save();
}

export function handleNewQuestion(event: LogNewQuestion): void {
  let questionId = event.params.question_id.toHexString();
  let question = new Question(questionId);

  question.template = event.params.template_id.toHexString();
  question.data = event.params.question;

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
    log.error('cannot find question {} to answer', [questionId]);
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
    log.error('cannot find question {} to begin arbitration', [questionId]);
    return;
  }

  question.isPendingArbitration = true;

  question.save();
}

export function handleFinalize(event: LogFinalize): void {
  let questionId = event.params.question_id.toHexString()
  let question = Question.load(questionId);
  if (question == null) {
    log.error('cannot find question {} to finalize', [questionId]);
    return;
  }

  question.isPendingArbitration = false;

  question.save();
}
