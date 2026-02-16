import {existsSync, readFileSync, writeFileSync} from 'fs';
import {SmjAbilityType, SMJ_DATA, SmjCardType} from './util/smj-data';

const RESET = '\x1b[0m';
const TEXT_RED = '\x1b[31m';
const TEXT_GREEN = '\x1b[32m';
const TEXT_YELLOW = '\x1b[33m';

const green = (text: string) => `${TEXT_GREEN}${text}${RESET}`;
const red = (text: string) => `${TEXT_RED}${text}${RESET}`;
const yellow = (text: string) => `${TEXT_YELLOW}${text}${RESET}`;

const output: string[] = [];
const log = (text: string) => {
	console.log(text);
	output.push(text);
};

enum CommandType {
	PowerAdd = "power",
	VoidAdd = "void",
	StartWells = "wells",
	PlayCard = "play",
	UseAbility = "ability",
	UseSpell = "spell",
	KillEntity = "kill",
	BuildWell = "well",
	BuildOrb = "orb",
	Boost = "boost",
	Unboost = "unboost",
	Buff = "buff",
	PrintState = "print",
	Wait = "wait",
}

enum BuffType {
	ShrineOfMemory = "Shrine of Memory",
	PowerShrine = "Power Shrine",
}

const BUFFS: {[key: string]: BuffType;} = {
	[BuffType.ShrineOfMemory]: BuffType.ShrineOfMemory,
	"som": BuffType.ShrineOfMemory,
	[BuffType.PowerShrine]: BuffType.PowerShrine,
	"ps": BuffType.PowerShrine,
};

const BUFF_DURATIONS: Record<BuffType, number> = {
	[BuffType.ShrineOfMemory]: 30,
	[BuffType.PowerShrine]: 30,
};

const BUFF_STACKS: Record<BuffType, number> = {
	[BuffType.ShrineOfMemory]: Number.POSITIVE_INFINITY,
	[BuffType.PowerShrine]: 3,
};

type Buff = {type: BuffType, duration: number, stacks: number;};
const Asap = -1;
const Now = -2;
type Command = {
	type: CommandType,
	when: typeof Asap | typeof Now | number,
	description: string,
	entity?: string,
	power?: number,
	discount?: number,
	void?: number,
	well?: number,
	boosts?: number[],
	buff?: Buff,
};

const toSeconds = (when: string) => {
	const [min, sec] = when.split(':');
	return 60 * +min + +sec;
};

const toTimestamp = (seconds: number) => {
	const min = Math.floor(seconds / 60);
	const sec = seconds - 60 * min;
	return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};

const cardByName = (cardName: string) => SMJ_DATA.find(card => card.cardName.toLowerCase() === cardName.toLowerCase());

const parseArgs = (raw: string): string[] => {
	const R = /(?:"([^"]+)"?|([^"\s]+))+/g;
	return (raw.match(R) as string[]).map(v => v[0] === '"' ? v.substring(1, v.length - 1) : v);
};

const parseCommands = (line: string): Command[] => {
	const firstSpace = line.indexOf(' ');
	const secondSpace = line.indexOf(' ', firstSpace + 1);
	const whenString = line.substring(0, firstSpace);
	const when = whenString.toLowerCase() === 'asap'
		? Asap
		: whenString.toLowerCase() === 'now'
			? Now
			: toSeconds(whenString);
	const type = (secondSpace !== -1 ? line.substring(firstSpace + 1, secondSpace) : line.substring(firstSpace + 1)).trim();
	const args = secondSpace !== -1 ? parseArgs(line.substring(secondSpace + 1)) : [];
	const card = cardByName(args[0] || '');

	try {
		switch (type) {
			case CommandType.PowerAdd:
				if (args.length !== 1) throw new Error('Power command expects 1 argument but got:' + args);
				return [{type, when, power: +args[0], description: `${+args[0] > 0 ? 'Gain' : 'Lose'} ${+args[0]} power`}];
			case CommandType.VoidAdd:
				if (args.length !== 1) throw new Error('Void command expects 1 argument but got:' + args);
				return [{type, when, void: +args[0], description: `${+args[0] > 0 ? 'Gain' : 'Lose'} ${+args[0]} void`}];
			case CommandType.StartWells:
				return args.map(capacity => ({type, when, well: +capacity, description: `Gain starting well (${capacity})`}));
			case CommandType.BuildWell:
				if (args.length !== 1) throw new Error('Build well command expects 1 argument but got:' + args);
				return [{type, when, power: -100, well: +args[0], description: `Build power well (${args[0]})`}];
			case CommandType.Boost:
				return [{type, when, power: -50, boosts: args.map(Number), description: `Boost power wells ${args.join('+')}`}];
			case CommandType.Unboost:
				return [{type, when, void: 45, boosts: args.map(Number), description: `Unboost power wells ${args.join('+')}`}];
			case CommandType.BuildOrb:
				if (args.length !== 1) throw new Error('Build orb command expects 1 argument but got:' + args);
				const orbCosts = [null, 0, 150, 250, 300];
				const orbCost = orbCosts[+args[0]];
				return [{type, when, power: -orbCost, description: `Build T${+args[0]} orb for ${orbCost} power`}];
			case CommandType.PlayCard:
			case '+':
				if (!(args.length >= 1 && args.length <= 2)) throw new Error('Play command expects 1-2 arguments but got:' + args);
				const amount = +(args.find(arg => arg.match(/^\d+$/)) || 1);
				const discountArgIdx = args.findIndex(arg => arg.match(/^\d+\%$/));
				const discount = discountArgIdx !== -1 ? +(args[discountArgIdx].slice(0, -1)) : 0;
				return Array(amount).fill({
					type: CommandType.PlayCard,
					when,
					power: -1 * card.powerCost[3],
					discount: discount / 100,
					entity: card.type !== SmjCardType.Spell ? card.cardName : null,
					void: card.type === SmjCardType.Spell ? 0.9 * card.powerCost[3] : null,
					description: `Play ${card.cardName}${discount ? ` (${discount}% discount)` : ''}`,
				});
			case CommandType.KillEntity:
			case '-':
				if (!(args.length >= 1 && args.length <= 2)) throw new Error('Kill command expects 1-2 arguments but got:' + args);
				return Array(args[1] ? +args[1] : 1).fill({
					type: CommandType.KillEntity,
					when,
					entity: card.cardName,
					void: 0.9 * card.powerCost[3],
					description: `Kill ${card.cardName}`,
				});
			case CommandType.UseAbility:
				if (!(args.length >= 1 && args.length <= 2)) throw new Error('Use ability command expects 1-2 arguments but got:' + args);
				const abilityIndex = args[1] ? +args[1] - 1 : 0;
				const ability = card.abilities.filter(a => a.abilityType === SmjAbilityType.Active)[abilityIndex];
				return [{
					type: CommandType.UseAbility,
					when,
					entity: card.cardName,
					power: -ability.abilityCost[3],
					description: `${card.cardName} -> ${ability.abilityName}`,
				}];
			case CommandType.UseSpell:
				if (args.length !== 1) throw new Error('Use spell command expects 1 argument but got:' + args);
				return [{
					type: CommandType.UseSpell,
					when,
					power: -args[0],
					description: `Use spell with cost ${args[0]}`,
				}];
			case CommandType.Buff:
				if (!(args.length >= 1 && args.length <= 2)) throw new Error('Use ability command expects 1-2 arguments but got:' + args);
				const buffType = BUFFS[args[0].toLowerCase()];
				if (!buffType) throw new Error('Invalid buff:' + args[0]);
				return [{
					type,
					when,
					buff: {type: buffType, duration: BUFF_DURATIONS[buffType], stacks: BUFF_STACKS[buffType]},
					description: `Apply buff ${buffType}`,
				}];
			case CommandType.PrintState:
			case '~':
				return [{type: CommandType.PrintState, when, description: 'Print state'}];
			case CommandType.Wait:
				return [{type: CommandType.Wait, when, description: 'Waiting for timer'}];
			default:
				throw new Error('Command type not implemented:' + type);
		}
	} catch (e) {
		console.error({when, type, line});
		throw e;
	}
};

const commands = readFileSync(process.argv[2]).toString().split('\n').map(parseCommands).flat();

const handlers: Record<CommandType, (command: Command) => void> = {
	[CommandType.PowerAdd]: command => {
		const newPower = power + command.power;
		if (newPower < 0) throw new Error(`Cant remove ${-command.power} power since there is only ${power} power`);
		power = newPower;
	},
	[CommandType.VoidAdd]: command => {
		const newVoid = voidPower + command.void;
		if (newVoid < 0) throw new Error(`Cant remove ${-command.void} power since there is only ${voidPower} power`);
		voidPower = newVoid;
	},
	[CommandType.BuildOrb]: command => {
		const newPower = power + command.power;
		if (newPower < 0) throw new Error(`Cant build monument for ${-command.power} power since there is only ${power} power`);
		power = newPower;
	},
	[CommandType.BuildWell]: command => {
		const newPower = power + command.power;
		if (newPower < 0) throw new Error(`Cant build power well for ${-command.power} power since there is only ${power} power`);
		power = newPower;

		wells.push({id: nextWellId++, remaining: command.well, max: command.well, boosted: false});
	},
	[CommandType.Boost]: command => {
		const newPower = power + command.power;
		if (newPower < 0) throw new Error(`Cant build resource booster for ${-command.power} power since there is only ${power} power`);
		power = newPower;

		command.boosts.forEach(id => wells.find(well => well.id === id).boosted = true);
	},
	[CommandType.Unboost]: command => {
		const unboostIds = command.boosts;
		if (unboostIds.some(id => !wells.find(well => well.id === id).boosted)) throw new Error('Can\'t unboost a well that is not boosted');
		command.boosts.forEach(id => wells.find(well => well.id === id).boosted = false);

		voidPower += command.void;
	},
	[CommandType.StartWells]: command => {
		wells.push({id: nextWellId++, remaining: command.well, max: command.well, boosted: false});
	},
	[CommandType.PlayCard]: command => {
		const discountedCost = command.power * (1 - command.discount || 0);

		const powerShrineBuffIdx = buffs.filter(v => v).findIndex(b => b.type === BuffType.PowerShrine);
		const powerShrineBuff = buffs[powerShrineBuffIdx];
		if (powerShrineBuff) {
			const totalPower = power + voidPower;
			if (totalPower + command.power < 0) throw new Error(`cant play ${command.entity} for ${-command.power} power despite power shrine buff, there is only ${totalPower} power`);

			const remainingVoid = voidPower + discountedCost;
			if (remainingVoid > 0) {
				voidPower = remainingVoid;
			} else {
				power = power + voidPower + discountedCost;
				voidPower = 0;
			}

			if (powerShrineBuff.stacks === 1) buffs.splice(powerShrineBuffIdx, 1);
			else powerShrineBuff.stacks--;
		} else {
			if (power + command.power < 0) throw new Error(`cant play ${command.entity} for ${-command.power} power, there is only ${power} power`);
			power += discountedCost;
		}

		if (command.void) voidPower += command.void;
		if (command.entity) {
			if (!entities[command.entity]) entities[command.entity] = 1;
			else entities[command.entity]++;
		}
	},
	[CommandType.KillEntity]: command => {
		if (!entities[command.entity]) throw new Error(`no entity "${command.entity}" to kill`);
		else entities[command.entity]--;

		voidPower += command.void;

		if (entities[command.entity] === 0) delete entities[command.entity];
	},
	[CommandType.UseAbility]: command => {
		if (!entities[command.entity]) throw new Error(`no entity "${command.entity}" to use ability`);
		if (power + command.power < 0) throw new Error(`cant use ability of ${command.entity} for ${-command.power} power, missing ${command.power - power} power`);

		power += command.power;
		voidPower += -0.9 * command.power;
	},
	[CommandType.UseSpell]: command => {
		if (power + command.power < 0) throw new Error(`cant use spell with cost ${-command.power} power, missing ${command.power - power} power`);

		power += command.power;
		voidPower -= 0.9 * command.power;
	},
	[CommandType.Buff]: command => {
		if (buffs.find(b => b.type === command.buff.type)) throw new Error(`buff of type ${command.buff.type} already exists`);

		buffs.push({
			type: command.buff.type,
			stacks: command.buff.stacks,
			until: now + command.buff.duration,
		});
	},
	[CommandType.Wait]: () => {},
	[CommandType.PrintState]: () => {
		log(`> Power/Void: ${Math.round(power)} + ${Math.round(voidPower)}`);
		if (wells.length) log(`> Wells: ${wells.map(w => `[${w.id}${w.boosted ? '*' : ''}] ${w.remaining}/${w.max}`).join(', ')}`);
		if (Object.entries(entities).length) log(`> Entities: ${Object.entries(entities).map(([entityName, amount]) => `${amount}x ${entityName}`).join(', ')}`);
		if (buffs.length) log(`> Buffs: ${buffs.map(buff => `${buff.type} (${buff.stacks} uses, ${toTimestamp(buff.until - now)} remaining)`)}`);
	}
};

const wells: {id: number, remaining: number; max: number; boosted: boolean;}[] = [];
const entities: {[name: string]: number;} = {};
const buffs: {type: BuffType, until: number, stacks: number, }[] = [];
let nextWellId = 1;
let now = 0;
let power = 0;
let voidPower = 0;

const tick = () => {
	if (voidPower > 0) {
		const voidReturn = (0.01 * voidPower) * (buffs.some(b => b.type === BuffType.ShrineOfMemory) ? 4 : 1);
		power += voidReturn;
		voidPower -= voidReturn;
	}

	if (now % 2 === 0) {
		for (let idx = 0; idx < wells.length; idx++) {
			const well = wells[idx];
			power += well.boosted ? 1.35 : 1;
			well.remaining -= well.boosted ? 3 : 1;

			if (well.remaining <= 0) {
				wells.splice(idx, 1);
				idx++;
			}
		}
	}

	for (let idx = 0; idx < buffs.length; idx++) {
		if (buffs[idx].until < now) {
			buffs.splice(idx, 1);
			idx--;
		}
	}

	now++;
};

for (const command of commands) {
	while (command.when > now) tick();

	if (command.when === Asap) {
		while (true) {
			try {
				handlers[command.type](command);
				log(`[${toTimestamp(now)}]: ${command.description} (calculated)`);
				break;
			} catch (e) {
				tick();
			}
		}
	} else {
		log(`[${toTimestamp(now)}]: ${command.description}`);
		handlers[command.type](command);
	}
}

const runName = process.argv[2].substring(process.argv[2].lastIndexOf('\\') + 1);
const outFile = `output\\${runName}`;
writeFileSync(outFile, output.join('\n'));
console.log('\nFile written:', outFile);
