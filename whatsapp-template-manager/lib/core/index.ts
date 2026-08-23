/**
 * The model, the rules and the reader. No DOM, no dependencies.
 *
 * Import this half on a server, in a test, or in a CI step that refuses a pull
 * request whose templates would not survive review.
 */
export * from "./types";
export * from "./limits";
export * from "./languages";
export * from "./variables";
export * from "./format";
export * from "./validate";
export * from "./decode";
export * from "./samples";
export * from "./starters";
