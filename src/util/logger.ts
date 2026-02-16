const LEVELS: {[key: string]: number;} = {
    TRACE: 0,
    DEBUG: 1,
    INFO: 2,
    WARN: 3,
    ERROR: 4,
};

let LOG_LEVEL = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.DEBUG;

const log = (level: number, ...args: any[]) => {
    if (level >= LOG_LEVEL) console.log(...args);
};

export const logger = {
    trace: (...args: any[]) => log(LEVELS.TRACE, 'TRC  ', ...args),
    debug: (...args: any[]) => log(LEVELS.DEBUG, 'DBG  ', ...args),
    info: (...args: any[]) => log(LEVELS.INFO, 'INFO ', ...args),
    warn: (...args: any[]) => log(LEVELS.WARN, 'WARN ', ...args),
    error: (...args: any[]) => log(LEVELS.ERROR, 'ERR  ', ...args),
    setLevel: (level: 0 | 1 | 2 | 3 | 4) => {LOG_LEVEL = level;},
};
