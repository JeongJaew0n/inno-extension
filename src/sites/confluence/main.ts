(() => {
  const requestEvent = 'inno-extension:confluence:select-prosemirror-node';
  const responseEvent = 'inno-extension:confluence:select-prosemirror-node-result';
  const bridgeFlag = '__innoExtensionConfluenceProseMirrorBridgeInstalled';
  let cachedEditor: ProseMirrorElement | undefined;
  let cachedView: ProseMirrorEditorView | undefined;

  interface ProseMirrorSelection {
    from: number;
    to: number;
    node?: unknown;
  }

  interface ProseMirrorTransaction {
    setSelection(selection: ProseMirrorSelection): ProseMirrorTransaction;
    scrollIntoView(): ProseMirrorTransaction;
  }

  interface ProseMirrorEditorState {
    doc: unknown;
    selection: ProseMirrorSelection & { constructor: Function };
    tr: ProseMirrorTransaction;
  }

  interface ProseMirrorEditorView {
    state: ProseMirrorEditorState;
    dispatch(transaction: ProseMirrorTransaction): void;
    focus(): void;
  }

  interface ProseMirrorViewDesc {
    parent?: ProseMirrorViewDesc | null;
    posBefore?: number;
    node?: { nodeSize?: number; textContent?: string };
    view?: ProseMirrorEditorView;
  }

  interface ProseMirrorElement extends HTMLElement {
    pmViewDesc?: ProseMirrorViewDesc;
  }

  interface BridgeWindow extends Window {
    [bridgeFlag]?: boolean;
  }

  const bridgeWindow = window as BridgeWindow;
  if (bridgeWindow[bridgeFlag]) return;
  bridgeWindow[bridgeFlag] = true;

  type BridgeAction = 'read-node' | 'select-node' | 'select-range';

  function respond(
    requestId: string,
    success: boolean,
    message?: string,
    text?: string,
  ): void {
    document.dispatchEvent(new CustomEvent(responseEvent, {
      detail: JSON.stringify({ requestId, success, message, text }),
    }));
  }

  function isEditorView(value: unknown): value is ProseMirrorEditorView {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<ProseMirrorEditorView>;
    return Boolean(candidate.state?.tr)
      && typeof candidate.dispatch === 'function'
      && typeof candidate.focus === 'function';
  }

  function findEditorView(desc: ProseMirrorViewDesc | undefined): ProseMirrorEditorView | undefined {
    let current = desc;
    while (current) {
      if (isEditorView(current.view)) return current.view;
      for (const key of Reflect.ownKeys(current)) {
        const value = (current as unknown as Record<PropertyKey, unknown>)[key];
        if (isEditorView(value)) return value;
      }
      current = current.parent ?? undefined;
    }
    return undefined;
  }

  function findEditorViewFromReact(editor: ProseMirrorElement): ProseMirrorEditorView | undefined {
    const fiberKey = Reflect.ownKeys(editor).find(
      (key) => typeof key === 'string' && key.startsWith('__reactFiber$'),
    );
    if (!fiberKey) return undefined;

    const root = (editor as unknown as Record<PropertyKey, unknown>)[fiberKey];
    if (!root || (typeof root !== 'object' && typeof root !== 'function')) return undefined;

    const queue: Array<{ value: object; depth: number }> = [{ value: root as object, depth: 0 }];
    const seen = new WeakSet<object>();
    let inspected = 0;

    let cursor = 0;
    while (cursor < queue.length && inspected < 8000) {
      const current = queue[cursor];
      cursor += 1;
      if (!current || seen.has(current.value)) continue;
      seen.add(current.value);
      inspected += 1;
      if (isEditorView(current.value)) return current.value;
      if (current.depth >= 16) continue;

      for (const key of Reflect.ownKeys(current.value).slice(0, 160)) {
        let candidate: unknown;
        try {
          candidate = (current.value as Record<PropertyKey, unknown>)[key];
        } catch {
          continue;
        }
        if (!candidate || (typeof candidate !== 'object' && typeof candidate !== 'function')) continue;
        if (candidate instanceof Node) continue;
        queue.push({ value: candidate as object, depth: current.depth + 1 });
      }
    }
    return undefined;
  }

  function findCodeBlockDesc(
    target: ProseMirrorElement,
    editor: HTMLElement,
  ): ProseMirrorViewDesc | undefined {
    let current: ProseMirrorElement | null = target;
    while (current && editor.contains(current)) {
      const desc = current.pmViewDesc;
      const nodeName = (desc?.node as { type?: { name?: unknown } } | undefined)?.type?.name;
      if (desc && nodeName === 'codeBlock') return desc;
      current = current.parentElement as ProseMirrorElement | null;
    }
    return undefined;
  }

  document.addEventListener(requestEvent, (event) => {
    let detail: {
      action?: unknown;
      requestId?: unknown;
      localId?: unknown;
      endLocalId?: unknown;
    } = {};
    if (event instanceof CustomEvent && typeof event.detail === 'string') {
      try {
        detail = JSON.parse(event.detail) as typeof detail;
      } catch {
        return;
      }
    }
    const requestId = typeof detail.requestId === 'string' ? detail.requestId : '';
    const action: BridgeAction = detail.action === 'read-node' || detail.action === 'select-range'
      ? detail.action
      : 'select-node';
    const localId = typeof detail.localId === 'string' ? detail.localId : '';
    const endLocalId = typeof detail.endLocalId === 'string' ? detail.endLocalId : '';
    if (!requestId || !localId) return;

    try {
      // 구간 선택은 문단을 대상으로 하므로 codeBlock으로 좁히지 않는다.
      const candidates = Array.from(document.querySelectorAll<ProseMirrorElement>(
        action === 'select-range'
          ? '[data-local-id]'
          : '[data-prosemirror-node-name="codeBlock"][data-local-id]',
      ));
      const target = candidates.find((node) => node.dataset.localId === localId);
      const editor = target?.closest<ProseMirrorElement>('.ProseMirror');
      const desc = target && editor
        ? (action === 'select-range' ? target.pmViewDesc : findCodeBlockDesc(target, editor))
        : undefined;

      if (action === 'read-node') {
        const text = desc?.node?.textContent;
        if (!target || !editor || typeof text !== 'string') {
          throw new Error('Confluence ProseMirror codeBlock 원문을 찾을 수 없습니다.');
        }
        respond(requestId, true, undefined, text);
        return;
      }

      const editorElement = editor as ProseMirrorElement | undefined;
      const view = editorElement === cachedEditor && isEditorView(cachedView)
        ? cachedView
        : findEditorView(desc)
          ?? findEditorView(editorElement?.pmViewDesc)
          ?? (editorElement ? findEditorViewFromReact(editorElement) : undefined);
      if (!editor || !view) throw new Error('Confluence ProseMirror 편집기 상태를 찾을 수 없습니다.');
      cachedEditor = editorElement;
      cachedView = view;

      const selectionClass = Object.getPrototypeOf(view.state.selection.constructor) as {
        fromJSON(
          doc: unknown,
          value: { type: 'node'; anchor: number } | { type: 'text'; anchor: number; head: number },
        ): ProseMirrorSelection;
      };

      if (action === 'select-range') {
        // 연속한 문단 구간을 한 번에 교체하려면 첫 문단부터 마지막 문단까지 text selection이 필요하다.
        // 경계가 아니라 문단 **안쪽**을 잡아야 붙여넣기가 블록을 통째로 대체한다.
        const endTarget = candidates.find((node) => node.dataset.localId === endLocalId) ?? target;
        const endDesc = endTarget?.pmViewDesc;
        const startPos = desc?.posBefore;
        const endPos = endDesc?.posBefore;
        const endSize = endDesc?.node?.nodeSize;
        if (!Number.isInteger(startPos) || !Number.isInteger(endPos) || !Number.isInteger(endSize)) {
          throw new Error('Confluence ProseMirror 문단 구간 위치를 찾을 수 없습니다.');
        }
        const from = (startPos as number) + 1;
        const to = (endPos as number) + (endSize as number) - 1;
        if (to <= from) throw new Error('Confluence ProseMirror 문단 구간이 비어 있습니다.');

        const rangeSelection = selectionClass.fromJSON(view.state.doc, {
          type: 'text',
          anchor: from,
          head: to,
        });
        view.dispatch(view.state.tr.setSelection(rangeSelection).scrollIntoView());
        view.focus();

        if (view.state.selection.from !== from || view.state.selection.to !== to) {
          throw new Error('Confluence ProseMirror 문단 구간 선택이 적용되지 않았습니다.');
        }
        respond(requestId, true);
        return;
      }

      const position = desc?.posBefore;
      const nodeSize = desc?.node?.nodeSize;
      if (!target || !Number.isInteger(position) || !Number.isInteger(nodeSize)) {
        throw new Error('Confluence ProseMirror codeBlock 위치를 찾을 수 없습니다.');
      }
      const selection = selectionClass.fromJSON(view.state.doc, {
        type: 'node',
        anchor: position as number,
      });
      view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
      view.focus();

      const applied = view.state.selection.from === position
        && view.state.selection.to === (position as number) + (nodeSize as number)
        && Boolean(view.state.selection.node);
      if (!applied) throw new Error('Confluence ProseMirror codeBlock 선택이 적용되지 않았습니다.');

      respond(requestId, true);
    } catch (error) {
      respond(
        requestId,
        false,
        error instanceof Error ? error.message : 'Confluence 편집기 선택에 실패했습니다.',
      );
    }
  });
})();
