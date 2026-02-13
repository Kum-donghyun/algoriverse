import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom"; // 상세페이지 이동을 위해 추가
import "../styles/Chatbot.css"; 

const QUICK_REPLIES = [
  "정치 관련 기사 찾아줘",
  "경제 뉴스 검색해줘",
];

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    { role: "assistant", content: "안녕하세요 😊" },
    { role: "assistant", content: "어떤 도움을 드릴까요?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open]);

  const send = async (text) => {
    const content = text ?? input;
    if (!content.trim()) return;

    const newMessages = [...messages, { role: "user", content }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:5000/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok) throw new Error("서버 응답 실패");
      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        { 
          role: "assistant", 
          content: data.reply,
          news: data.news // 서버에서 받은 기사 목록 저장
        },
      ]);
    } catch (error) {
      console.error("Chat Error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "서버 오류가 발생했어요 😢" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      <button className="chatbot-fab" onClick={() => setOpen((v) => !v)}>
        💬
      </button>

      {open && (
        <div className="chatbot-panel">
          <div className="chatbot-header">
            <span>챗봇 상담</span>
            <span className="close-btn" onClick={() => setOpen(false)}>✕</span>
          </div>

          <div className="chatbot-body">
            {messages.map((m, i) => (
              <div key={i} className={`bubble-wrapper ${m.role}`}>
                <div className={`bubble ${m.role === "user" ? "user" : "bot"}`}>
                  {m.content}
                  
                  {/* 기사 검색 결과 리스트 표시 */}
                  {m.news && m.news.length > 0 && (
                    <div className="news-results">
                      {m.news.map((item) => (
                        <div 
                          key={item.question_id} 
                          className="news-item"
                          onClick={() => {
                            if (item.link) {
                              window.open(item.link, '_blank');
                            } else {
                              navigate(`/board/${item.question_id}`);
                            }
                          }}
                        >
                          📰 {item.question_text.substring(0, 20)}...
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="bubble bot typing">
                입력중<span>.</span><span>.</span><span>.</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="quick-replies">
            {QUICK_REPLIES.map((q) => (
              <button key={q} onClick={() => send(q)}>{q}</button>
            ))}
          </div>

          <div className="chatbot-footer">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="메시지를 입력하세요"
              rows={1}
            />
            <button className="send-btn" onClick={() => send()}>전송</button>
          </div>
        </div>
      )}
    </>
  );
}