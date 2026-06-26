//  MockChatAdapter — returns regex-parsed ops without network, matching the ChatService interface.
//  Used when ADAPTER_MODE is MOCK (no backend).

/** @typedef {{ ops: object[], reply: string }} ChatResult */

export class MockChatAdapter {
  /**
   * Interpret a user message as pipeline edit ops.
   * In mock mode, always throws so the caller falls back to its local regex parser.
   * @param {string} _message
   * @param {string[]} _columns
   * @param {string} _yaml
   * @param {string} _interfaceName
   * @returns {Promise<ChatResult>}
   */
  async interpret(_message, _columns = [], _yaml = '', _interfaceName = '') {
    throw new Error('LLM unavailable (mock mode) — using regex fallback');
  }

  /** No-op in mock mode. */
  warmup() {}
}
