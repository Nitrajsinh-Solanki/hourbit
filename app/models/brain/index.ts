// app/models/brain/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Central export barrel for all Brain Challenge models.
//
// Always import from here:
//   import { Category, Subcategory, Level, Question,
//            UserLevelProgress, UserLevelSession } from "@/app/models/brain";
//
// Models are exported in parent-first order so Mongoose registers them
// in the correct sequence before cascade hooks try to resolve child models.
// ─────────────────────────────────────────────────────────────────────────────

export { Category }                                    from "./Category";
export type { ICategory }                              from "./Category";

export { Subcategory }                                 from "./Subcategory";
export type { ISubcategory }                           from "./Subcategory";

export { Level, UserLevelProgress, UserLevelSession }  from "./Level";
export type { ILevel, IUserLevelProgress, IUserLevelSession } from "./Level";

export { Question }                                    from "./Question";
export type { IQuestion }                              from "./Question";