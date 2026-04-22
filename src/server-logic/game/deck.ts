export const CHARACTERS = ['politico', 'empresario', 'investigador', 'juiz', 'assassino', 'guarda_costas'];

export function createDeck(playerCount: number) {
  const copies = playerCount <= 6 ? 3 : playerCount <= 8 ? 4 : 5;
  const deck: string[] = [];
  CHARACTERS.forEach(char => {
    for (let i = 0; i < copies; i++) deck.push(char);
  });
  return shuffle(deck);
}

export function shuffle(arr: any[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
