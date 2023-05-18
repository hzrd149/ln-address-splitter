import { createInvoiceForSplit } from "./lnurl.js";
import Router from "@koa/router";

const routes = new Router();

routes.get("/", (ctx) => ctx.render("index"));

routes.get("/split/:splitId", async (ctx) => {
  await ctx.render("split/index", {
    ogImage: new URL(
      `/qr?data=${ctx.state.splitAddress}&border=18&format=png`,
      ctx.state.publicUrl
    ),
  });
});

routes.get("/split/:splitId/invoice", async (ctx) => {
  const amount = Math.round(parseInt(ctx.query.amount as string));
  if (!amount) throw new Error("missing amount");
  const { payment_request, payment_hash } = await createInvoiceForSplit(
    ctx.state.split,
    amount,
    ctx.state.publicUrl
  );

  await ctx.render("split/invoice", {
    invoice: payment_request,
    hash: payment_hash,
  });
});

export default routes;
