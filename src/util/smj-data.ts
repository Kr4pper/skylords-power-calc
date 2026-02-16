import {readFileSync} from 'fs';

export enum SmjAbilityType {
    "Passive" = 0,
    "Active" = 1,
    "Toggle" = 2,
    "Autocast" = 3,
    "Godspell" = 4,
    "None" = -1,
};

export enum SmjCardType {
    "Unit" = 0,
    "Building" = 1,
    "Spell" = 2,
}

type SmjCard = {
    type: SmjCardType;
    cardNameSimple: string;
    officialCardIds: number[];
    powerCost: [number, number, number, number];
    abilities: {
        abilityName: string;
        abilityType: SmjAbilityType;
        abilityCost: [number, number, number, number];
    }[];
};

type SmjData = {
    data: SmjCard[];
};

export const SMJ_DATA = (JSON.parse(readFileSync('./src/util/smj_data.json').toString()) as SmjData)["data"].map(card => ({
    cardName: card.cardNameSimple,
    cardId: card.officialCardIds[0],
    powerCost: card.powerCost,
    abilities: card.abilities,
    type: card.type,
}));
