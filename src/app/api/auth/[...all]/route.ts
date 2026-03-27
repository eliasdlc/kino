import { auth } from "../../../../../auth";
import { toNodeHandler } from "better-auth/node";

const handler = toNodeHandler(auth.handler);

export { handler as GET, handler as POST };
