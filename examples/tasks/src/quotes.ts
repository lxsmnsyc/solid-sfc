export interface Quote {
  text: string;
  author: string;
}

const QUOTES: Quote[] = [
  { text: 'Simplicity is prerequisite for reliability.', author: 'Edsger W. Dijkstra' },
  { text: 'Make it work, make it right, make it fast.', author: 'Kent Beck' },
  { text: 'The best way to predict the future is to invent it.', author: 'Alan Kay' },
  { text: 'Programs must be written for people to read.', author: 'Harold Abelson' },
];

/** Pretends to fetch a quote from a server. */
export async function fetchQuote(index: number, fail: boolean): Promise<Quote> {
  await new Promise((resolve) => setTimeout(resolve, 800));
  if (fail) {
    throw new Error('The quote server is not responding.');
  }
  return QUOTES[index % QUOTES.length]!;
}
