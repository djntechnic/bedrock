declare function debug(message: string, context?: Record<string, unknown>): void;
declare function info(message: string, context?: Record<string, unknown>): void;
declare function warn(message: string, context?: Record<string, unknown>): void;
declare function error(message: string, context?: Record<string, unknown>): void;
export declare const logger: {
    debug: typeof debug;
    info: typeof info;
    warn: typeof warn;
    error: typeof error;
};
export {};
