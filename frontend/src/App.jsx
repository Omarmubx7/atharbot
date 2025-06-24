import React, { useState, useEffect, useRef } from 'react';
import logo from './Screenshot_2025-06-21_015705-removebg-preview (1).png';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const API_URL = import.meta.env.VITE_API_URL || 'https://atharbot-production.up.railway.app/api/query';

// Color palettes for dark and light mode
const PORTAL_LIGHT = {
  header: '#d8432a',
  accent: '#d8432a',
  cardBg: '#fff',
  chatBg: '#f4f7fa',
  userBubble: '#d8432a',
  botBubble: '#f1f0f0',
  text: '#23272f',
  textLight: '#fff',
  textGray: '#bfc9d1',
  online: '#43a047',
};
const PORTAL_DARK = {
  header: '#d8432a',
  accent: '#d8432a',
  cardBg: '#232b2f',
  chatBg: '#181a20',
  userBubble: '#d8432a',
  botBubble: '#232b2f',
  text: '#fff',
  textLight: '#fff',
  textGray: '#bfc9d1',
  online: '#43a047',
};
function getColors(dark) {
  return dark ? PORTAL_DARK : PORTAL_LIGHT;
}

function ChatBubble({ sender, children, dark, isBot }) {
  const COLORS = getColors(dark);
  return (
    <div
      className={`chat-bubble ${sender} ${dark ? 'dark' : ''}`}
      style={{
        alignSelf: sender === 'user' ? 'flex-end' : 'flex-start',
        background: sender === 'user' ? COLORS.userBubble : COLORS.botBubble,
        color: COLORS.text,
        borderRadius: 18,
        padding: '12px 18px',
        margin: '10px 0',
        maxWidth: '90vw',
        width: 'fit-content',
        minWidth: 60,
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        position: 'relative',
        transition: 'background 0.3s, color 0.3s',
        animation: sender === 'user' ? 'slideInRight 0.5s' : 'slideInLeft 0.5s',
        fontSize: 'clamp(1rem, 2vw, 1.15rem)',
        wordBreak: 'break-word',
      }}
    >
      <span style={{ color: COLORS.text }}>{children}</span>
    </div>
  );
}

function TypingBubble({ text, dark }) {
  const COLORS = getColors(dark);
  // Typing animation: reveal one word at a time
  const [displayed, setDisplayed] = React.useState('');
  React.useEffect(() => {
    setDisplayed('');
    if (!text) return;
    const words = text.split(' ');
    let i = 0;
    const interval = setInterval(() => {
      setDisplayed(t => t + (i === 0 ? '' : ' ') + words[i]);
      i++;
      if (i >= words.length) clearInterval(interval);
    }, 60);
    return () => clearInterval(interval);
  }, [text]);
  return (
    <ChatBubble sender="bot" dark={dark}>
      <span>{displayed}<span className="typing-cursor">|</span></span>
    </ChatBubble>
  );
}

function Markdown({ children, dark }) {
  const COLORS = getColors(dark);
  // Always render as string
  const str = typeof children === 'string' ? children : (children && children.props ? children.props.children : String(children));
  return (
    <span
      dangerouslySetInnerHTML={{
        __html: DOMPurify.sanitize(marked.parse(str))
      }}
      style={{ color: COLORS.text }}
    />
  );
}

function Suggestions({ suggestions, onClick, dark }) {
  if (!suggestions || suggestions.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, animation: 'fadeIn 0.5s' }}>
      {suggestions.map((s, i) => (
        <button
          key={i}
          onClick={() => onClick(s)}
          style={{
            background: dark ? '#23272f' : '#f1f0f0',
            color: dark ? '#ffd700' : '#2563eb',
            border: 'none',
            borderRadius: 8,
            padding: '6px 14px',
            fontWeight: 600,
            fontSize: 15,
            cursor: 'pointer',
            boxShadow: dark ? '0 2px 8px #0004' : '0 2px 8px #007bff22',
            transition: 'background 0.2s, color 0.2s, transform 0.15s',
            outline: 'none',
            animation: 'fadeIn 0.5s',
          }}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >{s}</button>
      ))}
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState([
    { sender: 'bot', text: 'Hi! You can ask about office hours, professors, days, or departments.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('atharbot-dark');
    return saved === null ? true : saved === 'true'; // default to dark mode
  });
  const [suggestions, setSuggestions] = useState([]);
  const [context, setContext] = useState(null);
  const chatRef = useRef(null);
  const [typing, setTyping] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600);
  const [lastUserMsg, setLastUserMsg] = useState('');

  useEffect(() => {
    localStorage.setItem('atharbot-dark', dark);
    document.body.style.background = getColors(dark).chatBg;
    const handleResize = () => setIsMobile(window.innerWidth < 600);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [dark]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, typing]);

  const sendMessage = async (e, overrideInput) => {
    if (e) e.preventDefault();
    const query = (overrideInput !== undefined ? overrideInput : input).trim();
    if (!query) return;
    setMessages((msgs) => [...msgs, { sender: 'user', text: query }]);
    setLastUserMsg(query);
    setLoading(true);
    setTyping(true);
    setInput('');
    try {
      const res = await fetch(`${API_URL}?q=${encodeURIComponent(query)}${context ? `&context=${encodeURIComponent(JSON.stringify(context))}` : ''}`);
      const data = await res.json();
      let botMsg = '';
      let newContext = null;
      if (data.type === 'person' && data.person) {
        const q = query.toLowerCase();
        const name = data.person.name || '';
        const department = data.person.department || '';
        const email = data.person.email || '';
        const office = data.person.office || '';
        const office_hours = data.person.office_hours || {};
        const availableDays = Object.keys(office_hours).join(', ');
        botMsg = `**${name}**  \n**Department:** ${department}  \n**Email:** ${email}  \n**Office:** ${office}  \n\n**Office Hours:**  \n${Object.entries(office_hours).map(([day, hours]) => `- **${day}:** ${hours}`).join('  \n')}  \n\n${name} is available on ${availableDays}.`;
        newContext = { type: 'person', person: data.person };
      } else if (data.type === 'day' && data.day && Array.isArray(data.people)) {
        botMsg = `**Available on ${data.day.charAt(0).toUpperCase() + data.day.slice(1)}:**\n${data.people.map(person => `- **${person.name}** (${person.department})`).join('\n')}`;
        newContext = { type: 'day', day: data.day };
      } else if (data.type === 'department' && data.department && Array.isArray(data.people)) {
        botMsg = `**Department: ${data.department.charAt(0).toUpperCase() + data.department.slice(1)}**\n${data.people.map(person => `- **${person.name}**`).join('\n')}`;
        newContext = { type: 'department', department: data.department };
      } else if (data.type === 'person-day' && data.person && data.day) {
        botMsg = `**${data.person.name} on ${data.day.charAt(0).toUpperCase() + data.day.slice(1)}:**\n${data.hours ? data.hours : 'No office hours on this day.'}`;
        newContext = { type: 'person', person: data.person };
      } else if (data.type === 'multiple' && Array.isArray(data.people)) {
        setTimeout(() => {
          setMessages((msgs) => [...msgs, { sender: 'bot', type: 'multiple', people: data.people }]);
          setTyping(false);
        }, Math.max(1000, data.people.length * 60));
        setSuggestions([]);
        setContext(null);
        setLoading(false);
        return;
      } else if (data.error) {
        botMsg = data.error + ' Try a full name or check spelling.';
        newContext = null;
      } else {
        botMsg = 'Sorry, I could not understand your question.';
        newContext = null;
      }
      setTimeout(() => {
        setMessages((msgs) => [...msgs, { sender: 'bot', text: botMsg }]);
        setTyping(false);
      }, Math.max(1000, String(botMsg).split(' ').length * 60));
      setSuggestions(data.suggestions || []);
      setContext(newContext);
    } catch (err) {
      setMessages((msgs) => [...msgs, { sender: 'bot', text: 'Sorry, I could not understand your question.' }]);
      setSuggestions([]);
      setContext(null);
      setTyping(false);
    }
    setLoading(false);
  };

  const handleSuggestion = (s) => {
    setInput(s);
    setTimeout(() => {
      sendMessage(null, s);
    }, 200);
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(
      typeof text === 'string' ? text : (text.props ? text.props.children : '')
    );
  };

  const handleRegenerate = () => {
    if (lastUserMsg) sendMessage(null, lastUserMsg);
  };

  const COLORS = getColors(dark);

  return (
    <div className={dark ? 'atharbot-dark' : ''} style={{
      minHeight: '100vh',
      background: COLORS.chatBg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
      transition: 'background 0.3s',
    }}>
      <div style={{
        width: isMobile ? '100%' : 480,
        maxWidth: isMobile ? '100vw' : 540,
        minWidth: 0,
        background: COLORS.cardBg,
        borderRadius: 18,
        boxShadow: '0 4px 24px #0002',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 500,
        border: 'none',
        transition: 'background 0.3s, box-shadow 0.3s',
        margin: '0 auto',
        position: 'relative',
        height: '80vh',
        maxHeight: 700,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: 20, borderBottom: 'none', background: COLORS.header, borderTopLeftRadius: 18, borderTopRightRadius: 18,
          position: 'relative',
        }}>
          <img src={logo} alt="Atharbot" style={{ width: 40, height: 40, borderRadius: 12, background: '#fff' }} />
          <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.2rem)', fontWeight: 700, margin: 0, color: COLORS.textLight, letterSpacing: 1, transition: 'color 0.3s' }}>Atharbot</h1>
          <button
            aria-label="Toggle dark mode"
            onClick={() => setDark(d => !d)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: COLORS.textLight, transition: 'color 0.3s', outline: 'none' }}
          >
            {dark ? '🌙' : '☀️'}
          </button>
        </div>
        {/* Chat area above input */}
        <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', margin: 0, padding: 24, background: COLORS.chatBg, transition: 'background 0.3s', minHeight: 0 }}>
          {messages.map((msg, i) => (
            msg.sender === 'bot' && msg.type === 'multiple' ? (
              <ChatBubble
                key={i}
                sender={msg.sender}
                dark={dark}
                isBot={true}
              >
                <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>
                  Multiple people found. Please pick one:
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {msg.people.map(person => (
                    <li key={person.email}>
                      <button
                        onClick={() => handleSuggestion(person.name)}
                        style={{
                          background: dark ? '#232b2f' : '#f1f0f0',
                          color: COLORS.text,
                          border: 'none',
                          borderRadius: 8,
                          padding: '10px 18px',
                          fontWeight: 700,
                          fontSize: 17,
                          cursor: 'pointer',
                          width: '100%',
                          textAlign: 'left',
                          boxShadow: dark ? '0 2px 8px #0004' : '0 2px 8px #007bff22',
                          transition: 'background 0.2s, color 0.2s, transform 0.15s',
                          outline: 'none',
                          display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                          marginBottom: 8,
                        }}
                        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
                        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        <span style={{ fontWeight: 900, fontSize: 18, color: COLORS.accent }}>{person.name}</span>
                        <span style={{ fontStyle: 'italic', fontSize: 15, color: dark ? '#ccc' : '#444' }}>{person.department}</span>
                        <span style={{ fontSize: 13, color: dark ? '#888' : '#888' }}>{person.email}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </ChatBubble>
            ) : msg.sender === 'bot' ? (
              <ChatBubble
                key={i}
                sender={msg.sender}
                dark={dark}
                isBot={true}
              >
                <Markdown dark={dark}>{msg.text}</Markdown>
              </ChatBubble>
            ) : (
              <ChatBubble key={i} sender={msg.sender} dark={dark}>{msg.text}</ChatBubble>
            )
          ))}
          {typing && <TypingBubble text={String(messages[messages.length-1]?.text) || ''} dark={dark} />}
        </div>
        {/* Input at the bottom */}
        <form onSubmit={sendMessage} style={{ display: 'flex', gap: 8, padding: 20, borderTop: 'none', background: COLORS.cardBg, borderBottomLeftRadius: 18, borderBottomRightRadius: 18, position: 'sticky', bottom: 0, zIndex: 2 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask anything about office hours, professors, days, or departments..."
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 8,
              border: '1px solid #bfc9d1',
              background: dark ? '#232b2f' : '#f4f7fa',
              color: dark ? '#fff' : COLORS.text,
              fontSize: 16,
              transition: 'background 0.3s, color 0.3s'
            }}
            disabled={loading}
          />
          <button type="submit" disabled={loading || !input.trim()} style={{
            background: COLORS.accent, color: COLORS.textLight, border: 'none', borderRadius: 8, padding: '0 20px', fontWeight: 600, fontSize: 16, boxShadow: '0 2px 8px #0002', cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.3s, transform 0.2s', outline: 'none',
            transform: loading ? 'scale(1)' : 'scale(1)',
          }}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >Send</button>
        </form>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
        @keyframes slideInLeft { from { opacity: 0; transform: translateX(-40px); } to { opacity: 1; transform: none; } }
        @keyframes slideInRight { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: none; } }
        .chat-bubble { animation: fadeIn 0.5s; }
        ::selection { background: ${COLORS.accent}; color: #fff; }
        .chat-bubble strong, .chat-bubble b {
          color: ${COLORS.accent} !important;
          font-weight: 900 !important;
        }
        input::placeholder {
          color: ${dark ? '#eee' : '#888'};
          opacity: 1;
        }
        @media (max-width: 600px) {
          .chat-bubble { font-size: 1rem !important; }
        }
      `}</style>
    </div>
  );
} 