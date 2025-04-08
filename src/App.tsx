import React, { useEffect, useRef, useState } from "react";
import { FaMicrophone } from "react-icons/fa";
import { FiSend } from "react-icons/fi";
import { AiOutlinePaperClip } from "react-icons/ai";

declare global {
  interface Window {
    googleTranslateElementInit: () => void;
    google: any;
  }
}

const App = () => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Google Translate widget loader
  useEffect(() => {
    const scriptId = "google-translate-script";
    if (document.getElementById(scriptId)) return;

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    script.type = "text/javascript";
    document.body.appendChild(script);

    window.googleTranslateElementInit = () => {
      new window.google.translate.TranslateElement(
        {
          pageLanguage: "en",
          includedLanguages: "en,hi,kn,ta,ml,te,bn",
          layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
        },
        "google_translate_element"
      );
    };
  }, []);

  const handleAudioUpload = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      setAudioFile(file);
      const url = URL.createObjectURL(file);
      setMessages((prev) => [...prev, { from: "user", audioUrl: url, file }]);
    }
  };

  const handleTranscribe = async (file: File, index: number) => {
    if (!file) return alert("No audio file to transcribe");
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("model", "whisper-large-v3");

      const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer GROQ API KEY`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to transcribe");

      const data = await response.json();
      const text = data.text;

      setMessages((prev) => {
        const updated = [...prev];
        updated[index].transcribedText = text;
        return [...updated, { from: "system", text }];
      });
    } catch (err: any) {
      alert("Transcription failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTranslate = (text: string) => {
    const existing = document.getElementById("translate-target");
    if (existing) existing.remove();

    const div = document.createElement("div");
    div.id = "translate-target";
    div.innerText = text;
    document.body.appendChild(div);

    window.googleTranslateElementInit?.();
  };

  const handleSendText = async () => {
    if (!inputText.trim()) return;

    const text = inputText.trim();
    setMessages((prev) => [...prev, { from: "user", text }]);
    setInputText("");

    if (text.startsWith("/chat ")) {
      const prompt = text.replace("/chat ", "");
      setLoading(true);
      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer GROQ API KEY`,
          },
          body: JSON.stringify({
            model: "meta-llama/llama-4-scout-17b-16e-instruct",
            messages: [{ role: "user", content: prompt }],
          }),
        });

        if (!response.ok) throw new Error("Chat completion failed");

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || "No response from AI.";
        setMessages((prev) => [...prev, { from: "bot", text: reply }]);
      } catch (err: any) {
        alert("AI chat failed: " + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleRecordAudio = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          const file = new File([audioBlob], "recorded_audio.webm", { type: "audio/webm" });
          setAudioFile(file);
          const url = URL.createObjectURL(audioBlob);
          setMessages((prev) => [...prev, { from: "user", audioUrl: url, file }]);
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (error) {
        alert("Microphone access denied or error occurred.");
      }
    }
  };

  return (
    <div style={{ width: "100vw", height: "100vh", backgroundColor: "#1f1f2f", color: "white", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", height: "100%" }}>
        {/* Sidebar */}
        <div style={{ width: "220px", background: "#12121c", padding: "16px", fontWeight: "bold", display: "flex", flexDirection: "column", gap: "8px", borderRight: "1px solid #444" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <img src="/chat.jpg" alt="Rocket Logo" style={{ height: "24px", width: "24px" }} />
            rocket.chat
          </div>
          
        </div>

        {/* Main Chat Area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {messages.map((msg, index) => (
              <div key={index} style={{ display: "flex", flexDirection: "column", alignItems: msg.from === "user" ? "flex-end" : "flex-start" }}>
                {msg.audioUrl && <audio controls src={msg.audioUrl} style={{ width: "100%" }} />}
                {msg.text && (
                  <div
                    style={{
                      padding: "12px",
                      borderRadius: "16px",
                      maxWidth: "75%",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      backgroundColor: msg.from === "user" ? "#3b82f6" : msg.from === "bot" ? "#16a34a" : "#444",
                      color: "white",
                    }}
                  >
                    {msg.text}
                  </div>
                )}
                {msg.audioUrl && msg.file && !msg.transcribedText && (
                  <button
                    onClick={() => handleTranscribe(msg.file, index)}
                    disabled={loading}
                    style={{ marginTop: "8px", padding: "4px 12px", borderRadius: "8px", backgroundColor: "#2563eb", color: "white", fontSize: "14px" }}
                  >
                    {loading ? "Transcribing..." : "Transcribe"}
                  </button>
                )}
                {msg.transcribedText && (
                  <button
                    onClick={() => handleTranslate(msg.transcribedText)}
                    style={{ marginTop: "8px", padding: "4px 12px", borderRadius: "8px", backgroundColor: "#10b981", color: "white", fontSize: "14px" }}
                  >
                    Translate
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Input Footer */}
          <div style={{ padding: "12px", background: "#2a2a3f", borderTop: "1px solid #555", display: "flex", alignItems: "center", gap: "8px" }}>
            <button onClick={() => fileInputRef.current?.click()} style={{ color: "white", background: "none", border: "none" }}>
              <AiOutlinePaperClip size={20} />
            </button>
            <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleAudioUpload} style={{ display: "none" }} />
            <input
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "6px",
                backgroundColor: "#1e1e2e",
                color: "white",
                fontSize: "14px",
                border: "none",
                outline: "none",
              }}
              placeholder="Message or type /chat ..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendText()}
            />
            {inputText.trim() ? (
              <button onClick={handleSendText} style={{ color: "white", background: "none", border: "none" }}>
                <FiSend size={20} />
              </button>
            ) : (
              <button onClick={handleRecordAudio} style={{ color: isRecording ? "#dc2626" : "white", background: "none", border: "none" }}>
                <FaMicrophone size={20} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
