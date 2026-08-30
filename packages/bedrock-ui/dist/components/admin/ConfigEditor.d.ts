import { type ConfigSetting } from "../../hooks/useAdminPlatform";
/** Group by `category`, preserving first-seen order within the response. */
export declare function groupByCategory(settings: ConfigSetting[]): Array<[string, ConfigSetting[]]>;
/** The two spellings the backend accepts for true. */
export declare function boolValue(value: string | null): value is "true" | "1";
export default function ConfigEditor(): import("react").JSX.Element;
