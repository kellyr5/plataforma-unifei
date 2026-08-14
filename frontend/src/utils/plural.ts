/**
 * Concordância de número nos textos da interface.
 *
 * A plataforma escrevia "3 dúvida(s)", "1 matriculado(s)", "2 inscrição(ões)".
 * A forma entre parênteses é recurso de formulário impresso, onde o número
 * ainda não é conhecido no momento da impressão. Aqui ele é conhecido: o
 * sistema sabe que são três, e escrever "dúvida(s)" é transferir ao leitor um
 * trabalho que a aplicação já podia ter feito.
 *
 * Num trabalho acadêmico apresentado à própria universidade, isso é
 * acabamento que a banca percebe.
 */

/** Devolve a forma correta conforme a quantidade, sem o número. */
export function plural(quantidade: number, singular: string, plural: string): string {
  return quantidade === 1 ? singular : plural
}

/** Devolve o número seguido da forma correta: `3 dúvidas`, `1 dúvida`. */
export function contar(
  quantidade: number,
  singular: string,
  formaPlural: string,
): string {
  return `${quantidade} ${plural(quantidade, singular, formaPlural)}`
}
