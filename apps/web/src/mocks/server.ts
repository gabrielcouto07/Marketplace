import { setupServer } from "msw/node";

import { handlers } from "./handlers";

/** Interceptação no Node (RSC, generateMetadata, sitemap). Registrado em src/instrumentation.ts. */
export const server = setupServer(...handlers);
