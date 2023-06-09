import Router from "@koa/router";
import { Split, removeSplit } from "../../../splits.js";
import { StateWithSplit } from "../../params.js";

export const deleteSplitRouter = new Router();

deleteSplitRouter.get<StateWithSplit>("/admin/split/:splitId/delete", (ctx) =>
  ctx.render("admin/split/delete")
);
deleteSplitRouter.post<StateWithSplit>(
  "/admin/split/:splitId/delete",
  async (ctx) => {
    await removeSplit(ctx.state.split.id);
    await ctx.redirect("/admin");
  }
);
