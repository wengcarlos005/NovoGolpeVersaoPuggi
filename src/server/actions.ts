export interface ActionDef {
  basic?: boolean;
  challengeable: boolean;
  blockable: boolean;
  requiresTarget: boolean;
  cost?: number;
  character?: string;
  blockedBy?: string[];
  anyoneCanBlock?: boolean;
  targetLosesInfluence?: boolean;
}

export const ACTION_DEFS: Record<string, ActionDef> = {
  renda: {
    basic: true, challengeable: false, blockable: false, requiresTarget: false,
  },
  ajuda_externa: {
    basic: true, challengeable: false, blockable: true, blockedBy: ['politico'],
    requiresTarget: false, anyoneCanBlock: true,
  },
  golpe: {
    basic: true, cost: 7, challengeable: false, blockable: false,
    requiresTarget: true, targetLosesInfluence: true,
  },
  taxar: {
    character: 'politico', challengeable: true, blockable: false, requiresTarget: false,
  },
  roubar: {
    character: 'empresario', challengeable: true, blockable: true,
    blockedBy: ['juiz', 'guarda_costas'], requiresTarget: true, anyoneCanBlock: false,
  },
  assassinar: {
    character: 'assassino', cost: 3, challengeable: true, blockable: true,
    blockedBy: ['guarda_costas'], requiresTarget: true, targetLosesInfluence: true, anyoneCanBlock: false,
  },
  meter_x9: {
    character: 'investigador', challengeable: true, blockable: true,
    blockedBy: ['juiz'], requiresTarget: true, anyoneCanBlock: false,
  },
  disfarce: {
    character: 'investigador', challengeable: true, blockable: true,
    blockedBy: ['juiz'], requiresTarget: false, anyoneCanBlock: false,
  },
  trocar_carta: {
    character: 'investigador', challengeable: true, blockable: true,
    blockedBy: ['juiz'], requiresTarget: true, anyoneCanBlock: false,
  },
};

export const ACTION_NAMES: Record<string, string> = {
  renda:        'Trampo Suado',
  ajuda_externa:'Imposto é Roubo',
  golpe:        'Golpe de Estado',
  taxar:        'Faz o L',
  roubar:       'Pegar o Arrego',
  assassinar:   'Mandar pro Vasco',
  meter_x9:     'Meter o X9',
  disfarce:     'Disfarce',
  trocar_carta: 'Troca de Cartas',
};

export const CHARACTER_NAMES: Record<string, string> = {
  politico:      'Político',
  empresario:    'Bicheiro',
  investigador:  'X9',
  juiz:          'Juiz',
  assassino:     'Miliciano',
  guarda_costas: 'Segurança',
};

export function getBlockers(actionType: string) {
  return ACTION_DEFS[actionType]?.blockedBy || [];
}
