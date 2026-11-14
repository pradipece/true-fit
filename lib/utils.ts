export { cn } from "cn";

/**
 * Enter that should submit. While an input method (Vietnamese Telex, Chinese, Japanese,
 * Korean…) is still composing, Enter only commits the word; submitting then would clear
 * the field and let the IME write the composed text back into it. Safari reports that
 * commit keydown with keyCode 229 instead of isComposing.
 */
export function isSubmitEnter(e: {
  key: string;
  shiftKey?: boolean;
  keyCode?: number;
  nativeEvent: KeyboardEvent;
}) {
  return e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229;
}
