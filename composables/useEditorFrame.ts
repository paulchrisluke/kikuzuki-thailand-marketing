import type { ComputedRef, InjectionKey, Ref } from 'vue'

/**
 * Which of the two columns a level of the editor chain occupies, if any.
 *
 * The chain is unbounded and the screen shows exactly two levels: the one you
 * are on and its parent. Every level decides this for itself, from its own base
 * path and the current route — no level knows anything about its descendants,
 * and no level counts a depth that is not its own.
 *
 * - `index`  — I am the deepest level. I render my own content, and my parent
 *              is showing me as its detail (or I am the whole screen).
 * - `pair`   — one of my children is open. I am the index column; that child
 *              renders as the detail.
 * - `yield`  — the open level is deeper than my child, so neither column is
 *              mine. I render nothing but the route beneath me.
 *
 * This is what stops shells nesting. An ancestor that kept rendering its own
 * index while a grandchild rendered another pair put three columns on screen
 * and left the leaf a third of the width it should have had.
 */
export type EditorFrameMode = 'index' | 'pair' | 'yield'

/** Set by a level rendering in `pair` mode, so its descendants know they are inside a detail column. */
export const EDITOR_FRAME_NESTED = Symbol('editor-frame-nested') as InjectionKey<ComputedRef<boolean>>

export function useEditorFrame(basePath: Ref<string> | ComputedRef<string>) {
  const route = useRoute()

  /** The route segments below this level. */
  const rest = computed(() => {
    const base = basePath.value
    if (!base || !route.path.startsWith(base)) return []
    return route.path.slice(base.length).replace(/^\//, '').split('/').filter(Boolean)
  })

  const mode = computed<EditorFrameMode>(() => {
    if (rest.value.length === 0) return 'index'
    if (rest.value.length === 1) return 'pair'
    return 'yield'
  })

  /** Names the open child, for the active row and the detail's heading. */
  const childSegment = computed(() => rest.value[0] ?? null)

  /**
   * Whether an ancestor is already rendering this level inside its detail
   * column. The outermost level on screen owns the dashboard panel and navbar;
   * a level inside someone else's detail renders content only, or it would draw
   * a second header inside the pane.
   */
  const parentNested = inject(EDITOR_FRAME_NESTED, null)
  const nested = computed(() => parentNested?.value ?? false)
  provide(EDITOR_FRAME_NESTED, computed(() => mode.value === 'pair' || nested.value))

  const ownsChrome = computed(() => !nested.value)

  return { rest, mode, childSegment, nested, ownsChrome }
}
