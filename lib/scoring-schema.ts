// Zod schemas for the asset-scoring feature.
//
// Role in the architecture: the single definition of what a valid checklist
// question, a valid set of answers and a valid hand-typed score look like. The
// Client Components import these to validate before submitting, and the Server
// Actions import the SAME schemas to validate again — the browser check is a
// convenience, the server check is the rule (same pattern as lib/asset-schema).

import { z } from 'zod'
import { SCORE_SCOPES, MANUAL_SCORE_MIN, MANUAL_SCORE_MAX } from '@/lib/constants'

// One checklist question. `hint` is the supporting note shown underneath, e.g.
// "Histórico: 5 anos"; empty input becomes null so the DB has one shape for
// "no hint" instead of two ('' and null).
export const scoreQuestionSchema = z.object({
  scope: z.enum(SCORE_SCOPES, { error: 'Selecione a lista' }),
  text: z
    .string()
    .trim()
    .min(1, 'Escreva a pergunta')
    .max(200, 'Pergunta muito longa'),
  hint: z
    .string()
    .trim()
    .max(120, 'Observação muito longa')
    .optional()
    .nullable()
    .transform((value) => (value ? value : null)),
})

// Editing a question never moves it between checklists: the answers already
// given are tied to its scope, so changing it would silently invalidate them.
export const scoreQuestionEditSchema = scoreQuestionSchema.omit({ scope: true })

// One answer. There is no "unanswered" value here: a question left blank simply
// is not in the array the client sends (the missing row IS the blank).
const scoreAnswerSchema = z.object({
  questionId: z.string().min(1),
  value: z.boolean({ error: 'Resposta inválida' }),
})

// A whole evaluation. Allowed to be empty — clearing every answer is how the
// user un-grades an asset.
export const assetAnswersSchema = z.array(scoreAnswerSchema)

// The hand-typed score for crypto and fixed income. Same range the checklist
// produces, so the "Nota" column means one thing across the whole table. Null
// clears it back to "not graded".
export const manualScoreSchema = z.object({
  manualScore: z
    .number({ error: 'Nota inválida' })
    .int('Use um número inteiro')
    .min(MANUAL_SCORE_MIN, `Mínimo ${MANUAL_SCORE_MIN}`)
    .max(MANUAL_SCORE_MAX, `Máximo ${MANUAL_SCORE_MAX}`)
    .nullable()
    .optional()
    .transform((value) => (value ?? null)),
})

export type ScoreQuestionInput = z.input<typeof scoreQuestionSchema>
export type ScoreQuestionParsed = z.output<typeof scoreQuestionSchema>
export type ScoreQuestionEditInput = z.input<typeof scoreQuestionEditSchema>
export type AssetAnswersInput = z.input<typeof assetAnswersSchema>
export type ManualScoreInput = z.input<typeof manualScoreSchema>
