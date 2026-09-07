export type TransferOnboardingQueryScope =
  | { kind: 'exact'; transferId: string }
  | { kind: 'invalid'; message: string }

const INVALID_TRANSFER_QUERY_MESSAGE = 'The transfer query parameter is invalid.'

export function parseTransferOnboardingQuery(query: unknown): TransferOnboardingQueryScope {
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    return { kind: 'invalid', message: INVALID_TRANSFER_QUERY_MESSAGE }
  }

  const queryRecord = query as Record<string, unknown>
  if (!Object.prototype.hasOwnProperty.call(queryRecord, 'transfer')) {
    return { kind: 'invalid', message: INVALID_TRANSFER_QUERY_MESSAGE }
  }

  const rawTransferId = queryRecord.transfer
  if (typeof rawTransferId !== 'string') {
    return { kind: 'invalid', message: INVALID_TRANSFER_QUERY_MESSAGE }
  }

  const transferId = rawTransferId.trim()
  if (!transferId || transferId !== rawTransferId) {
    return { kind: 'invalid', message: INVALID_TRANSFER_QUERY_MESSAGE }
  }

  return { kind: 'exact', transferId: rawTransferId }
}
