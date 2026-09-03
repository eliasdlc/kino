import { implement } from "@orpc/server";
import { authenticate, translateDomainErrors, type ApiContext } from "@/shared/api/procedures";
import { searchContract } from "./search.contract";
import { searchAll } from "./search.service";

const os = implement(searchContract)
  .$context<ApiContext>()
  .use(translateDomainErrors)
  .use(authenticate);

export const searchRouter = os.router({
  // El mínimo de caracteres lo aplica `searchAll`, que también recorta.
  all: os.all.handler(({ context, input }) => searchAll(context.userId, input.q ?? "")),
});
