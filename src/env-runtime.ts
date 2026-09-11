import { parseEnv } from "@/env";

// biome-ignore lint/style/noProcessEnv: Accessing process.env is required here
export default parseEnv(process.env);
