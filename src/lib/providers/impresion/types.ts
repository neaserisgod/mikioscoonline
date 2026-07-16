import type { TicketModel } from "@/domain/ticket"

export interface ImpresionProvider {
  imprimir(terminalId: string, ticket: TicketModel): Promise<void>
}
