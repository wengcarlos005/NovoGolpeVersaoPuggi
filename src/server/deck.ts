export const CHARACTERS = ['politico', 'empresario', 'investigador', 'juiz', 'assassino', 'guarda_costas'];

export function createDeck() {
  const deck: string[] = [];
  CHARACTERS.forEach(char => {
    deck.push(char, char, char); // 3 copies each = 18 cards
  });
  return shuffle(deck);
}

export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
