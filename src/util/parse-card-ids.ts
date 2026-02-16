import {readFileSync, writeFileSync} from 'fs';

const cardIdsFile = readFileSync('src/data/card-ids.txt').toString().split('\r\n');
console.log('Input file read, number of lines is', cardIdsFile.length);

const cards = new Map<string, number>();

let idx = 0;
while (idx < cardIdsFile.length - 1) {
    const id = cardIdsFile[idx++].match(/(\d+)/)[0];
    const name = cardIdsFile[idx++].match(/(\w+)/)[0];
    cards.set(name, +id);
}

const result = `export enum CardIds {
    ${[...cards.entries()]
        .map(([name, id]) => `${name} = ${id},`)
        .join('\n ')
    }
}
    
export const allCardIds: CardIds[] = Object.values(CardIds).filter(v => typeof v !== 'string');

export const allCards: {[key: string]: CardIds} = {
    ${[...cards.entries()]
        .map(([name]) => `${name}: CardIds.${name},`)
        .join('\n ')
    }
}`;

writeFileSync('src/util/card-ids.ts', result);
console.log('Output file written with', cards.size, 'entries');
