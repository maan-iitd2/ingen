import { useState, useRef, useEffect, useCallback } from 'react';
import { useConfig } from '../../../state/ConfigContext.jsx';
import { useChatSession } from '../../../state/ChatSessionContext.jsx';
import { applyOps } from '../../../models/applyIntent.js';
import { interpretMessage, warmup } from '../../../services/chatService.js';
import { columnsForSources } from '../../../lib/columnStore.js';
import { modelToYaml } from '../../../serializers/yamlSerializer.js';
import {
  getActiveSession,
  getSessions,
  saveSession,
  createSession,
} from '../../../services/chatHistoryService.js';

function welcomeMessage(interfaceName) {
  return {
    id: 'welcome',
    sender: 'assistant',
    text: `Hi! I'm **inChat**, your pipeline assistant for **${interfaceName}**. Tell me what you want in plain language — I'll wire up sources, filters, and output for you. The suggestions below are tailored to what you've built so far.`,
  };
}

// Regex fallback — used when the local model is unavailable. Returns the SAME ops shape the backend
// produces, so a single applier handles both paths.
function regexOps(text) {
  const t = text.trim();
  let m;
  if ((m = t.match(/^add\s+columns?\s+(.+)/i))) {
    const cols = m[1].split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
    return cols.length ? [{ op: 'add_columns', cols }] : [];
  }
  if ((m = t.match(/^rename\s+(\w+)\s+(?:to\s+)?(\w+)/i))) return [{ op: 'rename_column', from: m[1], to: m[2] }];
  if ((m = t.match(/^add\s+source\s+(\w+)\s+(\w+)/i))) return [{ op: 'add_source', name: m[1], type: m[2].toLowerCase() }];
  if ((m = t.match(/^filter\s+(\w+)\s+(.+)/i))) return [{ op: 'add_filter', col: m[1], val: m[2] }];
  if ((m = t.match(/^change\s+output\s+to\s+(\w+)/i))) return [{ op: 'set_output', type: m[1].toLowerCase() }];
  return [];
}

// Suggestion chips derived from current state — always valid, never LLM-guessed.
function suggestionsFor(iface, columns) {
  const out = [];
  if (columns.length) out.push(`add columns ${columns.slice(0, 3).join(', ')}`);
  else if ((iface?.columns?.length ?? 0) === 0) out.push('add columns id, status, amount');
  const col = columns[0] || (iface?.columns?.[0]?.src_col_name);
  if (col) out.push(`filter ${col} CLOSED`);
  if (!iface?.output?.type) out.push('change output to excel');
  return out.slice(0, 3);
}

export default function InterfaceChatEditor({ interfaceName, iface }) {
  const { model, updateModel } = useConfig();
  const { setActiveSessionId, command, consumeCommand } = useChatSession();
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const knownColumns = columnsForSources(iface?.sources ?? []);

  // Pre-warm the local model once when the chat opens, so the first message isn't slow.
  useEffect(() => { warmup(); }, []);

  useEffect(() => {
    const active = getActiveSession(interfaceName);
    if (active && active.messages.length > 0) {
      setSessionId(active.id);
      setMessages(active.messages);
    } else {
      const newSession = createSession(interfaceName);
      setSessionId(newSession.id);
      setMessages([welcomeMessage(interfaceName)]);
    }
  }, [interfaceName]);

  useEffect(() => {
    if (sessionId) setActiveSessionId(sessionId);
  }, [sessionId, setActiveSessionId]);

  useEffect(() => {
    if (!command) return;
    if (command.kind === 'new') {
      const fresh = createSession(interfaceName);
      setSessionId(fresh.id);
      setMessages([welcomeMessage(interfaceName)]);
      consumeCommand();
    } else if (command.kind === 'load' && command.interfaceName === interfaceName) {
      const target = getSessions(interfaceName).find((s) => s.id === command.sessionId);
      if (target) {
        setSessionId(target.id);
        setMessages(target.messages.length ? target.messages : [welcomeMessage(interfaceName)]);
      }
      consumeCommand();
    }
  }, [command, interfaceName, consumeCommand]);

  useEffect(() => {
    if (sessionId && messages.length > 0) {
      saveSession(interfaceName, { id: sessionId, messages, createdAt: new Date().toISOString() });
    }
  }, [messages, sessionId, interfaceName]);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages, isTyping]);

  const handleSendMessage = useCallback((textToSend) => {
    if (!textToSend.trim()) return;
    setMessages((prev) => [...prev, { id: `msg-${Date.now()}`, sender: 'user', text: textToSend }]);
    setInputValue('');
    setIsTyping(true);

    // Ask the local model for a concise reply + ordered ops, giving it the current pipeline YAML so
    // it edits what exists instead of starting fresh. Fall back to the regex parser if it's down.
    const yaml = (() => { try { return modelToYaml(model); } catch { return ''; } })();
    interpretMessage(textToSend, knownColumns, yaml, interfaceName)
      .catch(() => ({ ops: regexOps(textToSend), reply: '' }))
      .then(({ ops, reply: modelReply }) => {
        // applyOps is pure: it threads the model through every op and returns the final model +
        // a deterministic confirmation. The serializer renders the YAML from the mutated model.
        const { model: nextModel, reply, changed } = applyOps(model, interfaceName, knownColumns, ops);
        updateModel(() => nextModel);
        setIsTyping(false);
        // The model answers in two modes: EDIT (ops present) and CONVERSATION (no ops — greetings,
        // questions). Show its reply when an edit applied OR when it's just chatting; fall back to
        // the deterministic message only when an edit was attempted but nothing changed (dedupe,
        // unknown column) or the model is down (regex fallback gives no reply).
        const isConversation = (ops?.length ?? 0) === 0;
        const text = modelReply && (changed || isConversation) ? modelReply : reply;
        setMessages((prev) => [...prev, { id: `msg-reply-${Date.now()}`, sender: 'assistant', text }]);
      });
  }, [model, updateModel, interfaceName, knownColumns]);

  const chips = suggestionsFor(iface, knownColumns);

  return (
    <div className="chateditor">
      <div className="chateditor__messages">
        {messages.map((m) => (
          <div key={m.id} className={`chatbubble chatbubble--${m.sender}`}>
            <div className={`chatbubble__avatar chatbubble__avatar--${m.sender}`}>
              {m.sender === 'user' ? 'U' : 'AI'}
            </div>
            <div className={`chatbubble__content chatbubble__content--${m.sender}`} style={{ whiteSpace: 'pre-line' }}>
              {m.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="chatbubble chatbubble--assistant">
            <div className="chatbubble__avatar chatbubble__avatar--assistant">AI</div>
            <div className="chatbubble__content chatbubble__content--assistant">
              <div className="typing-indicator"><span></span><span></span><span></span></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chateditor__inputarea">
        <div className="prompt-chips">
          {chips.map((c) => (
            <button key={c} className="prompt-chip" onClick={() => handleSendMessage(c)}>+ {c}</button>
          ))}
        </div>

        <form className="chateditor__form" onSubmit={(e) => { e.preventDefault(); handleSendMessage(inputValue); }}>
          <input
            type="text"
            className="chateditor__input"
            placeholder="Describe a change to your pipeline…"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isTyping}
          />
          <button type="submit" className="btn btn--accent" disabled={!inputValue.trim() || isTyping} style={{ padding: '10px 20px' }}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
