import { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";
import blakeBody from "./assets/blakebody.png";
import blakeBodyGesture from "./assets/blakebodygesture.png";
import face from "./assets/face.png";
import psBucket from "./assets/PSbucket.png";
const API_URL = import.meta.env.VITE_API_URL;

function App() {
  // ---------- Site-wide login ----------
  const [siteToken, setSiteToken] = useState(
    () => localStorage.getItem("siteToken") || "",
  );
  const [isSiteUnlocked, setIsSiteUnlocked] = useState(
    () => !!localStorage.getItem("siteToken"),
  );
  const [sitePasswordInput, setSitePasswordInput] = useState("");
  const [sitePasswordError, setSitePasswordError] = useState("");

  const [answeringIndex, setAnsweringIndex] = useState(null);
  const [answerText, setAnswerText] = useState("");
  const [answerStatus, setAnswerStatus] = useState("");

  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // ---------- Chat state ----------
  const [input, setInput] = useState("");
  const [lastMessage, setLastMessage] = useState("");
  const [isGesturing, setIsGesturing] = useState(false);
  const [isFastBob, setIsFastBob] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [bubbleText, setBubbleText] = useState(
    "Welcome to the Festival Foods Deli Assistant. (Note: if I've been asleep for a bit, my first answer might take a little longer while I wake up)",
  );

  const [bulkText, setBulkText] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [manageView, setManageView] = useState("menu"); // "menu" | "facts" | "bulk"
  // ---------- Manage panel state ----------
  const [showManage, setShowManage] = useState(false);
  const [isManageUnlocked, setIsManageUnlocked] = useState(false);
  const [managePasswordInput, setManagePasswordInput] = useState("");
  const [managePasswordError, setManagePasswordError] = useState("");
  const [managePassword, setManagePassword] = useState(""); // held in memory only, never persisted

  const [facts, setFacts] = useState([]);
  const [loadingFacts, setLoadingFacts] = useState(false);
  const [newFact, setNewFact] = useState("");
  const [addStatus, setAddStatus] = useState("");
  const [editingIndex, setEditingIndex] = useState(null);
  const [editText, setEditText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [appHeight, setAppHeight] = useState(() => window.innerHeight);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const [showWrongInfoButton, setShowWrongInfoButton] = useState(false);
  const [showWrongInfoForm, setShowWrongInfoForm] = useState(false);
  const [wrongInfoName, setWrongInfoName] = useState("");
  const [wrongInfoType, setWrongInfoType] = useState(null); // "fullyWrong" | "missingInfo"
  const [wrongInfoHowToImprove, setWrongInfoHowToImprove] = useState("");
  const [wrongInfoStatus, setWrongInfoStatus] = useState("");
  const [expandedIndex, setExpandedIndex] = useState(null);

  const [wrongInfoReports, setWrongInfoReports] = useState([]);
  const [loadingWrongInfoReports, setLoadingWrongInfoReports] = useState(false);
  const [resolvingIndex, setResolvingIndex] = useState(null);
  const [resolveText, setResolveText] = useState("");
  const [resolveStatus, setResolveStatus] = useState("");

  const wrongInfoTimerRef = useRef(null);

  const filteredFacts = facts.filter((f) =>
    f.info.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const NON_ACTIONABLE_SUGGESTIONS = [
    "No unanswered questions yet — nothing to suggest.",
    "No suggestions right now — recent questions may already be answered.",
    "Couldn't generate suggestions right now — please try again.",
  ];

  const NON_REPORTABLE_RESPONSES = [
    "This message has been flagged and an alert has been sent to the administrator. Let a supervisor know if this is a mistake, and use the Deli Assistant responsibly.",
    "That's outside what I can help with here — I can only answer questions about the deli/store.",
    "Sorry, I do not have that information. If this is a mistake, add the information using the 'Manage Info' button.",
    "Sorry, something went wrong reaching the AI.",
    "Sorry, I didn't get a response. Please try again.",
    "Something went wrong.",
  ];

  const timeoutRef = useRef(null);
  const requestIdRef = useRef(0);
  const inputAreaRef = useRef(null);

  // Lock app height to the real layout viewport — ignore height-only
  // changes caused by the mobile keyboard (which don't change width)
  useEffect(() => {
    let lastWidth = window.innerWidth;
    function handleResize() {
      if (window.innerWidth !== lastWidth) {
        lastWidth = window.innerWidth;
        setAppHeight(window.innerHeight);
      }
    }
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  // Track how much the keyboard is covering, via the visualViewport API
  useEffect(() => {
    if (!window.visualViewport) return;
    function handleViewportChange() {
      const vv = window.visualViewport;
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardOffset(offset);
    }
    window.visualViewport.addEventListener("resize", handleViewportChange);
    window.visualViewport.addEventListener("scroll", handleViewportChange);
    handleViewportChange();
    return () => {
      window.visualViewport.removeEventListener("resize", handleViewportChange);
      window.visualViewport.removeEventListener("scroll", handleViewportChange);
    };
  }, []);

  useEffect(() => {
    setIsGesturing(true);
    const timer = setTimeout(() => {
      setIsGesturing(false);
    }, 10);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (inputAreaRef.current && !inputAreaRef.current.contains(e.target)) {
        setIsTyping(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ---------- Site login ----------
  const handleSiteLogin = () => {
    if (sitePasswordInput.trim() === "") return;

    fetch(`${API_URL}/site/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: sitePasswordInput }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          localStorage.setItem("siteToken", data.token);
          setSiteToken(data.token);
          setIsSiteUnlocked(true);
          setSitePasswordError("");
        } else {
          setSitePasswordError("Incorrect password.");
        }
      })
      .catch((err) => {
        console.error("Error logging in:", err);
        setSitePasswordError("Something went wrong.");
      });
  };

  const handleSiteLoginKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSiteLogin();
    }
  };

  const siteLogout = () => {
    localStorage.removeItem("siteToken");
    setSiteToken("");
    setIsSiteUnlocked(false);
  };

  // ---------- Manage panel ----------
  const loadFacts = (password) => {
    setLoadingFacts(true);
    fetch(`${API_URL}/facts/list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteToken, password }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setIsManageUnlocked(false);
          setManagePasswordError("Session issue, please try again.");
          setLoadingFacts(false);
          return;
        }
        setFacts(data);
        setLoadingFacts(false);
      })
      .catch((err) => {
        console.error("Error loading info:", err);
        setLoadingFacts(false);
      });
  };

  async function removeSuggestion(index) {
    const suggestion = suggestions[index];

    const res = await fetch(`${API_URL}/facts/suggestions/remove`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        suggestion,
        siteToken,
        password: managePassword,
      }),
    });

    const data = await res.json();

    if (data.error) {
      alert(data.error);
      return;
    }

    // Update UI with new suggestions list
    setSuggestions(data);
  }

  useEffect(() => {
    const imgs = [blakeBody, blakeBodyGesture].map((src) => {
      const img = new Image();
      img.src = src;
      return img;
    });
    Promise.all(
      imgs.map((img) =>
        img.decode ? img.decode().catch(() => {}) : Promise.resolve(),
      ),
    );
  }, []);

  const startAnswer = (index) => {
    setAnsweringIndex(index);
    setAnswerText("");
    setAnswerStatus("");
  };

  const cancelAnswer = () => {
    setAnsweringIndex(null);
    setAnswerText("");
    setAnswerStatus("");
  };

  const submitAnswer = (index) => {
    if (answerText.trim() === "") return;

    const suggestionText = suggestions[index];

    setAnswerStatus("Saving...");
    setSuggestions([]); // Clear suggestions to avoid confusion
    fetch(`${API_URL}/facts/add-answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteToken,
        password: managePassword,
        suggestion: suggestionText,
        answer: answerText.trim(),
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setAnswerStatus("Failed to save.");
          return;
        }
        setAnswerStatus("Saved!");
        setTimeout(() => {
          cancelAnswer();
          loadSuggestions();
        }, 1000);
      })
      .catch((err) => {
        console.error("Error saving answer:", err);
        setAnswerStatus("Failed to save.");
      });
  };

  const handleAnswerKeyDown = (e, index) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitAnswer(index);
    }
    if (e.key === "Escape") {
      cancelAnswer();
    }
  };

  const loadWrongInfoReports = () => {
    setLoadingWrongInfoReports(true);
    fetch(`${API_URL}/wrong-info/list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteToken, password: managePassword }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setLoadingWrongInfoReports(false);
          return;
        }
        setWrongInfoReports(data);
        setLoadingWrongInfoReports(false);
      })
      .catch((err) => {
        console.error("Error loading wrong info reports:", err);
        setLoadingWrongInfoReports(false);
      });
  };

  const startResolve = (index) => {
    setResolvingIndex(index);
    setResolveText("");
    setResolveStatus("");
  };

  const cancelResolve = () => {
    setResolvingIndex(null);
    setResolveText("");
    setResolveStatus("");
  };

  const submitResolve = (index) => {
    if (resolveText.trim() === "") return;

    const report = wrongInfoReports[index];

    setResolveStatus("Saving...");
    fetch(`${API_URL}/wrong-info/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteToken,
        password: managePassword,
        report,
        correctedInfo: resolveText.trim(),
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) {
          setResolveStatus("Failed to save.");
          return;
        }
        setResolveStatus("Saved!");
        setTimeout(() => {
          cancelResolve();
          setExpandedIndex(null);
          loadWrongInfoReports();
        }, 1000);
      })
      .catch((err) => {
        console.error("Error resolving wrong info report:", err);
        setResolveStatus("Failed to save.");
      });
  };

  const dismissReport = (index) => {
    if (!window.confirm("Dismiss this report as not an issue?")) return;

    const report = wrongInfoReports[index];

    setResolveStatus("Dismissing...");
    fetch(`${API_URL}/wrong-info/dismiss`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteToken,
        password: managePassword,
        report,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) {
          setResolveStatus("Failed to dismiss.");
          return;
        }
        setExpandedIndex(null);
        loadWrongInfoReports();
      })
      .catch((err) => {
        console.error("Error dismissing wrong info report:", err);
        setResolveStatus("Failed to dismiss.");
      });
  };

  const handleResolveKeyDown = (e, index) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitResolve(index);
    }
    if (e.key === "Escape") {
      cancelResolve();
    }
  };

  const loadSuggestions = () => {
    setLoadingSuggestions(true);
    fetch(`${API_URL}/facts/suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteToken, password: managePassword }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setLoadingSuggestions(false);
          return;
        }
        setSuggestions(data);
        setLoadingSuggestions(false);
      })
      .catch((err) => {
        console.error("Error loading suggestions:", err);
        setLoadingSuggestions(false);
      });
  };

  const openManage = () => {
    setShowManage(true);
    setAddStatus("");
    setManagePasswordError("");
    setManagePasswordInput("");
    setIsManageUnlocked(false);
    setManageView("menu");
  };

  const goBack = useCallback(() => {
    if (editingIndex !== null) {
      cancelEdit();
      return;
    }
    if (answeringIndex !== null) {
      cancelAnswer();
      return;
    }
    if (resolvingIndex !== null) {
      cancelResolve();
      return;
    }
    if (expandedIndex !== null) {
      setExpandedIndex(null);
      return;
    }
    if (isManageUnlocked && manageView !== "menu") {
      if (manageView === "suggestions") {
        setSuggestions([]);
      }
      if (manageView === "wrongInfo") {
        setWrongInfoReports([]);
        setExpandedIndex(null);
      }
      setManageView("menu");
      return;
    }
    closeManage();
  }, [
    editingIndex,
    answeringIndex,
    resolvingIndex,
    expandedIndex,
    isManageUnlocked,
    manageView,
  ]);

  useEffect(() => {
    if (!showManage) return;
    function handleEscapeKey(e) {
      if (e.key === "Escape") {
        goBack();
      }
    }
    document.addEventListener("keydown", handleEscapeKey);
    return () => document.removeEventListener("keydown", handleEscapeKey);
  }, [showManage, goBack]);

  const handleManageUnlock = () => {
    if (managePasswordInput.trim() === "") return;

    fetch(`${API_URL}/manage/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteToken, password: managePasswordInput }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setManagePassword(managePasswordInput);
          setIsManageUnlocked(true);
          setManagePasswordError("");
          loadFacts(managePasswordInput);
        } else {
          setManagePasswordError("Incorrect password.");
        }
      })
      .catch((err) => {
        console.error("Error checking password:", err);
        setManagePasswordError("Something went wrong.");
      });
  };

  const handleManagePasswordKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleManageUnlock();
    }
  };

  const closeManage = () => {
    setShowManage(false);
    setIsManageUnlocked(false);
    setManagePassword("");
    setSearchQuery("");
    setManageView("menu");
  };

  const handleDeleteFact = (index) => {
    fetch(`${API_URL}/facts/delete/${index}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteToken, password: managePassword }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) return;
        loadFacts(managePassword);
      })
      .catch((err) => console.error("Error deleting fact:", err));
  };

  const startEdit = (fact) => {
    setEditingIndex(fact.index);
    setEditText(fact.info);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditText("");
  };

  const saveEdit = (index) => {
    if (editText.trim() === "") return;

    fetch(`${API_URL}/facts/edit/${index}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteToken,
        password: managePassword,
        info: editText.trim(),
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) return;
        cancelEdit();
        loadFacts(managePassword);
      })
      .catch((err) => console.error("Error editing fact:", err));
  };

  const handleEditKeyDown = (e, index) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveEdit(index);
    }
    if (e.key === "Escape") {
      cancelEdit();
    }
  };

  const handleAddFact = () => {
    if (newFact.trim() === "") return;

    setAddStatus("Saving...");
    fetch(`${API_URL}/facts/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteToken,
        password: managePassword,
        info: newFact.trim(),
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setAddStatus("Failed to save.");
          return;
        }
        setNewFact("");
        setAddStatus("Saved!");
        loadFacts(managePassword);
        setTimeout(() => setAddStatus(""), 1500);
      })
      .catch((err) => {
        console.error("Error adding fact:", err);
        setAddStatus("Failed to save.");
      });
  };

  const handleBulkAdd = () => {
    if (bulkText.trim() === "") return;

    setBulkStatus("Saving...");
    fetch(`${API_URL}/facts/bulk-add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteToken,
        password: managePassword,
        infoBlock: bulkText,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setBulkStatus("Failed to save.");
          return;
        }
        setBulkText("");
        setBulkStatus(data.response);
        loadFacts(managePassword);
        setTimeout(() => setBulkStatus(""), 2000);
      })
      .catch((err) => {
        console.error("Error bulk adding facts:", err);
        setBulkStatus("Failed to save.");
      });
  };

  const handleAddKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAddFact();
    }
  };

  // ---------- Chat ----------
  const handleSend = () => {
    if (input.trim() === "") return;

    requestIdRef.current += 1;
    const thisRequestId = requestIdRef.current;

    setLastMessage(input);
    setInput("");
    setBubbleText("...thinking...");
    setIsTyping(false);
    setShowWrongInfoButton(false);
    if (wrongInfoTimerRef.current) clearTimeout(wrongInfoTimerRef.current);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      if (requestIdRef.current === thisRequestId) {
        setBubbleText("Sorry, I didn't get a response. Please try again.");
      }
    }, 90000);

    fetch(`${API_URL}/getAI`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteToken, message: input }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (requestIdRef.current !== thisRequestId) return;

        if (data.error) {
          siteLogout();
          return;
        }

        clearTimeout(timeoutRef.current);
        setBubbleText(data.response);

        setIsFastBob(true);
        setTimeout(() => setIsFastBob(false), 1000);

        setIsGesturing(true);
        setTimeout(() => setIsGesturing(false), 5000);

        if (!NON_REPORTABLE_RESPONSES.includes(data.response)) {
          setShowWrongInfoButton(true);
          wrongInfoTimerRef.current = setTimeout(() => {
            setShowWrongInfoButton(false);
          }, 60000);
        }
      })
      .catch((err) => {
        if (requestIdRef.current !== thisRequestId) return;
        clearTimeout(timeoutRef.current);
        console.error("Error:", err);
        setBubbleText("Something went wrong.");
      });
  };

  const openWrongInfoForm = () => {
    setShowWrongInfoButton(false);
    if (wrongInfoTimerRef.current) clearTimeout(wrongInfoTimerRef.current);
    setWrongInfoName("");
    setWrongInfoType(null);
    setWrongInfoHowToImprove("");
    setWrongInfoStatus("");
    setShowWrongInfoForm(true);
  };

  const closeWrongInfoForm = () => {
    setShowWrongInfoForm(false);
  };

  const submitWrongInfoReport = () => {
    if (wrongInfoType === null || wrongInfoHowToImprove.trim() === "") {
      setWrongInfoStatus(
        "Please select an option and describe how to improve it.",
      );
      return;
    }

    const text = bubbleText.split("(Note:")[0].trim();

    setWrongInfoStatus("Submitting...");
    fetch(`${API_URL}/wrong-info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteToken,
        response: text,
        name: wrongInfoName.trim(),
        fullyWrong: wrongInfoType === "fullyWrong",
        howToImprove: wrongInfoHowToImprove.trim(),
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) {
          setWrongInfoStatus(!data.success);
          return;
        }
        setWrongInfoStatus("Thanks, submitted!");
        setTimeout(() => {
          closeWrongInfoForm();
        }, 1200);
      })
      .catch((err) => {
        console.error("Error submitting wrong info report:", err);
        setWrongInfoStatus("Failed to submit.");
      });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape" && !e.shiftKey) {
      setIsTyping(false);
    }
  };

  // ---------- Site login gate ----------
  if (!isSiteUnlocked) {
    return (
      <div className="site-login">
        <div className="site-login-box">
          <h2>Festival Foods Deli Assistant</h2>
          <p>Please enter the access password to continue.</p>
          <p style={{ fontSize: "10px" }}>
            (this will grant you access for up to 2 months)
          </p>
          <input
            type="password"
            placeholder="Password"
            value={sitePasswordInput}
            onChange={(e) => setSitePasswordInput(e.target.value)}
            onKeyDown={handleSiteLoginKeyDown}
            autoFocus
          />
          <button onClick={handleSiteLogin}>Enter</button>
          {sitePasswordError && (
            <p style={{ color: "red", fontSize: "13px" }}>
              {sitePasswordError}
            </p>
          )}
          <p style={{ fontSize: "10px" }}>
            logging in may take upwards of 30 seconds
          </p>
        </div>
      </div>
    );
  }

  // ---------- Main app ----------
  return (
    <div className="app" style={{ height: `${appHeight}px` }}>
      <button className="manage-button" onClick={openManage}>
        Manage Info
      </button>

      {showManage && (
        <div className="manage-overlay" onClick={goBack}>
          <div className="manage-panel" onClick={(e) => e.stopPropagation()}>
            {!isManageUnlocked ? (
              <>
                <h3>Enter Manage Password</h3>
                <div className="add-fact-row">
                  <input
                    type="password"
                    placeholder="Password"
                    value={managePasswordInput}
                    onChange={(e) => setManagePasswordInput(e.target.value)}
                    onKeyDown={handleManagePasswordKeyDown}
                    autoFocus
                  />
                  <button onClick={handleManageUnlock}>Unlock</button>
                </div>
                {managePasswordError && (
                  <p style={{ color: "red", fontSize: "13px" }}>
                    {managePasswordError}
                  </p>
                )}
                <button className="close-button" onClick={closeManage}>
                  Cancel
                </button>
              </>
            ) : manageView === "menu" ? (
              <>
                <h3>Manage Info</h3>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    marginTop: "16px",
                  }}
                >
                  <button onClick={() => setManageView("facts")}>
                    Manage Info (view / add / edit / delete)
                  </button>
                  <button onClick={() => setManageView("bulk")}>
                    Bulk Add
                  </button>
                  <button
                    onClick={() => {
                      setManageView("suggestions");
                      loadSuggestions();
                    }}
                  >
                    Suggestions
                  </button>
                  <button
                    onClick={() => {
                      setManageView("wrongInfo");
                      loadWrongInfoReports();
                    }}
                  >
                    Wrong/Missing Info Reports
                  </button>
                </div>
                <button className="close-button" onClick={closeManage}>
                  Close
                </button>
              </>
            ) : manageView === "bulk" ? (
              <>
                <h3>Bulk Add</h3>
                <p style={{ marginTop: "-15px", fontSize: "12px" }}>
                  One piece of info per line. (Press enter/new line to enter
                  multiple)
                </p>
                <textarea
                  placeholder={
                    "coleslaw is 4.99/lb\nribs are in the back cooler\ndeli closes at 9pm"
                  }
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  rows={14}
                  style={{
                    width: "100%",
                    padding: "10px",
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                    fontSize: "0.95rem",
                    resize: "vertical",
                  }}
                />
                <button
                  onClick={handleBulkAdd}
                  style={{ marginTop: "10px", marginRight: "10px" }}
                >
                  Add All
                </button>
                {bulkStatus && <p className="add-status">{bulkStatus}</p>}

                <button
                  className="close-button"
                  onClick={() => setManageView("menu")}
                  style={{ marginTop: "12px" }}
                >
                  Back
                </button>
              </>
            ) : manageView === "suggestions" ? (
              <>
                <h3>Suggested Info to Add</h3>
                <p style={{ marginTop: "-15px", fontSize: "12px" }}>
                  A few things you might want to add based on previous
                  unanswered questions. (Answer the questions in complete
                  answers)
                </p>
                <p
                  style={{
                    marginTop: "-1px",
                    marginBottom: "-8px",
                    fontSize: "12px",
                  }}
                >
                  --------------------------------------------------
                </p>

                {loadingSuggestions && (
                  <p style={{ marginTop: "10px", marginBottom: "10px" }}>
                    Loading...
                  </p>
                )}
                {!loadingSuggestions && suggestions.length === 0 && (
                  <p>No suggestions right now.</p>
                )}

                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {suggestions.map((s, i) => {
                    const isActionable =
                      !NON_ACTIONABLE_SUGGESTIONS.includes(s);

                    return (
                      <li
                        key={i}
                        style={{
                          display: "block",
                          marginBottom: "16px",
                        }}
                      >
                        <div style={{ display: "block", marginBottom: "8px" }}>
                          {s}
                        </div>

                        {isActionable &&
                          (answeringIndex === i ? (
                            <div
                              style={{
                                display: "block",
                                width: "100%",
                              }}
                            >
                              <textarea
                                placeholder="Type the info to add..."
                                value={answerText}
                                onChange={(e) => setAnswerText(e.target.value)}
                                onKeyDown={(e) => handleAnswerKeyDown(e, i)}
                                autoFocus
                                rows={2}
                                style={{
                                  display: "block",
                                  width: "100%",
                                  padding: "6px",
                                  boxSizing: "border-box",
                                  fontFamily: "inherit",
                                  fontSize: "0.95rem",
                                  resize: "vertical",
                                  marginBottom: "6px",
                                }}
                              />
                              <div style={{ display: "flex", gap: "6px" }}>
                                <button onClick={() => submitAnswer(i)}>
                                  Save
                                </button>
                                <button onClick={cancelAnswer}>Cancel</button>
                              </div>
                              {answerStatus && (
                                <p
                                  className="add-status"
                                  style={{ margin: 0, marginTop: "6px" }}
                                >
                                  {answerStatus}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div>
                              <button
                                onClick={() => startAnswer(i)}
                                style={{ marginRight: "10px" }}
                              >
                                Add Answer
                              </button>
                              <button
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      "Are you sure you want to remove this suggestion?",
                                    )
                                  ) {
                                    removeSuggestion(i);
                                  }
                                }}
                              >
                                Remove Suggestion
                              </button>
                            </div>
                          ))}
                      </li>
                    );
                  })}
                </ul>

                <button
                  className="close-button"
                  onClick={() => {
                    setManageView("menu");
                    setSuggestions([]);
                  }}
                  style={{ marginTop: "12px" }}
                >
                  Back
                </button>
              </>
            ) : manageView === "wrongInfo" ? (
              <>
                <h3>Wrong/Missing Info Reports</h3>
                <p style={{ marginTop: "-15px", fontSize: "12px" }}>
                  Reports submitted by users about wrong or missing info. Tap
                  one to see details.
                </p>

                {loadingWrongInfoReports && (
                  <p style={{ marginTop: "10px", marginBottom: "10px" }}>
                    Loading...
                  </p>
                )}
                {!loadingWrongInfoReports && wrongInfoReports.length === 0 && (
                  <p>No reports right now.</p>
                )}

                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {wrongInfoReports.map((r, i) => {
                    const isExpanded = expandedIndex === i;

                    return (
                      <li
                        key={i}
                        style={{
                          display: "block",
                          marginBottom: "10px",
                          border: "1px solid #eee",
                          borderRadius: "6px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          onClick={() =>
                            setExpandedIndex(isExpanded ? null : i)
                          }
                          style={{
                            padding: "10px",
                            cursor: "pointer",
                            fontSize: "13px",
                            background: isExpanded ? "#f5f5f5" : "white",
                            overflowWrap: "break-word",
                          }}
                        >
                          {r.response}
                        </div>

                        {isExpanded && (
                          <div
                            style={{
                              padding: "10px",
                              borderTop: "1px solid #eee",
                            }}
                          >
                            <p
                              style={{ margin: "0 0 6px 0", fontSize: "13px" }}
                            >
                              <strong>
                                {r.fullyWrong
                                  ? "Fully Wrong"
                                  : "Partially Wrong"}
                              </strong>
                            </p>
                            <p
                              style={{ margin: "0 0 10px 0", fontSize: "13px" }}
                            >
                              How to improve: <strong>{r.howToImprove}</strong>
                            </p>

                            {resolvingIndex === i ? (
                              <div style={{ display: "block", width: "100%" }}>
                                <textarea
                                  placeholder="Type the corrected/complete fact..."
                                  value={resolveText}
                                  onChange={(e) =>
                                    setResolveText(e.target.value)
                                  }
                                  onKeyDown={(e) => handleResolveKeyDown(e, i)}
                                  autoFocus
                                  rows={2}
                                  style={{
                                    display: "block",
                                    width: "100%",
                                    padding: "6px",
                                    boxSizing: "border-box",
                                    fontFamily: "inherit",
                                    fontSize: "0.95rem",
                                    resize: "vertical",
                                    marginBottom: "6px",
                                  }}
                                />
                                <div style={{ display: "flex", gap: "6px" }}>
                                  <button onClick={() => submitResolve(i)}>
                                    Save
                                  </button>
                                  <button onClick={cancelResolve}>
                                    Cancel
                                  </button>
                                </div>
                                {resolveStatus && (
                                  <p
                                    className="add-status"
                                    style={{ margin: 0, marginTop: "6px" }}
                                  >
                                    {resolveStatus}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div
                                style={{
                                  display: "flex",
                                  gap: "6px",
                                  justifyContent: "center",
                                }}
                              >
                                <button onClick={() => startResolve(i)}>
                                  Fix This
                                </button>
                                <button onClick={() => dismissReport(i)}>
                                  Dismiss (Not an Issue)
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>

                <button
                  className="close-button"
                  onClick={() => {
                    setManageView("menu");
                    setWrongInfoReports([]);
                    setExpandedIndex(null);
                  }}
                  style={{ marginTop: "12px" }}
                >
                  Back
                </button>
              </>
            ) : (
              <>
                <h3>Stored Deli Info</h3>
                <p style={{ marginTop: "-25px", fontSize: "12px" }}>
                  Be as detailed as possible when adding new information.
                </p>

                <div className="add-fact-row">
                  <input
                    type="text"
                    placeholder="e.g. coleslaw is 4.99/lb"
                    value={newFact}
                    onChange={(e) => setNewFact(e.target.value)}
                    onKeyDown={handleAddKeyDown}
                  />
                  <button onClick={handleAddFact}>Add</button>
                </div>
                {addStatus && <p className="add-status">{addStatus}</p>}

                <input
                  type="text"
                  placeholder="Search stored info..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px",
                    marginBottom: "10px",
                    boxSizing: "border-box",
                  }}
                />

                {loadingFacts && <p>Loading...</p>}
                {!loadingFacts && facts.length === 0 && (
                  <p>No info stored yet.</p>
                )}
                {!loadingFacts &&
                  facts.length > 0 &&
                  filteredFacts.length === 0 && <p>No matches found.</p>}
                <ul>
                  {filteredFacts.map((f) => (
                    <li
                      key={f.index}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: "10px",
                      }}
                    >
                      {editingIndex === f.index ? (
                        <>
                          <input
                            type="text"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={(e) => handleEditKeyDown(e, f.index)}
                            autoFocus
                            style={{ flex: 1, minWidth: 0 }}
                          />
                          <div
                            style={{
                              display: "flex",
                              gap: "6px",
                              flexShrink: 0,
                            }}
                          >
                            <button onClick={() => saveEdit(f.index)}>
                              Save
                            </button>
                            <button onClick={cancelEdit}>Cancel</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <span
                            style={{
                              flex: 1,
                              minWidth: 0,
                              wordBreak: "break-word",
                            }}
                          >
                            {f.info}
                          </span>
                          <div
                            style={{
                              display: "flex",
                              gap: "6px",
                              flexShrink: 0,
                            }}
                          >
                            <button onClick={() => startEdit(f)}>Edit</button>
                            <button
                              onClick={() => {
                                if (
                                  window.confirm(
                                    "Are you sure you want to delete this fact?",
                                  )
                                ) {
                                  handleDeleteFact(f.index);
                                }
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>

                <button
                  className="close-button"
                  onClick={() => setManageView("menu")}
                >
                  Back
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="messages">
        {lastMessage && <div className="message">{lastMessage}</div>}
      </div>
      <div className="speech-bubble">
        <div className="speech-bubble-content">
          <p>
            {(() => {
              const noteIndex = bubbleText.indexOf("(Note:");
              if (noteIndex === -1) return bubbleText;

              const mainText = bubbleText.slice(0, noteIndex).trimEnd();
              const noteText = bubbleText.slice(noteIndex);

              return (
                <>
                  {mainText}
                  <br />
                  <br />
                  <span style={{ fontSize: "0.8em", opacity: 0.8 }}>
                    {noteText}
                  </span>
                </>
              );
            })()}
          </p>
        </div>
      </div>

      {showWrongInfoForm && (
        <div className="manage-overlay" onClick={closeWrongInfoForm}>
          <div className="manage-panel" onClick={(e) => e.stopPropagation()}>
            <h3>Report Wrong/Missing Info</h3>
            <p
              style={{
                marginTop: "-20px",
                marginBottom: "20px",
                fontSize: "14px",
                color: "#9b2400",
                overflowWrap: "break-word",
                wordBreak: "break-word",
              }}
            >
              "{bubbleText.split("(Note:")[0].trim()}"
            </p>
            <p style={{ marginTop: "-10px", fontSize: "12px" }}>
              Your name (optional):
            </p>
            <div className="add-fact-row">
              <input
                type="text"
                placeholder="Your name"
                value={wrongInfoName}
                onChange={(e) => setWrongInfoName(e.target.value)}
              />
            </div>

            <p style={{ fontSize: "13px", marginBottom: "6px" }}>
              Was the answer fully wrong, or just missing something?
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                marginBottom: "12px",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "14px",
                }}
              >
                <input
                  type="radio"
                  name="wrongInfoType"
                  checked={wrongInfoType === "fullyWrong"}
                  onChange={() => setWrongInfoType("fullyWrong")}
                />
                Fully wrong
              </label>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "14px",
                }}
              >
                <input
                  type="radio"
                  name="wrongInfoType"
                  checked={wrongInfoType === "missingInfo"}
                  onChange={() => setWrongInfoType("missingInfo")}
                />
                Just missing some info
              </label>
            </div>

            <p style={{ fontSize: "13px", marginBottom: "6px" }}>
              How should this be improved?
            </p>
            <textarea
              placeholder="e.g. the price of coleslaw is $5.99/lb"
              value={wrongInfoHowToImprove}
              onChange={(e) => setWrongInfoHowToImprove(e.target.value)}
              rows={4}
              style={{
                width: "100%",
                padding: "8px",
                boxSizing: "border-box",
                fontFamily: "inherit",
                fontSize: "0.95rem",
                resize: "vertical",
                marginBottom: "10px",
              }}
            />

            <button onClick={submitWrongInfoReport}>Submit</button>

            <button
              className="close-button"
              onClick={closeWrongInfoForm}
              style={{ marginLeft: "10px" }}
            >
              Cancel
            </button>
            {wrongInfoStatus && (
              <p
                className="add-status"
                style={{
                  fontSize: "0.725em",
                  color: wrongInfoStatus.includes("Thanks") ? "green" : "red",
                }}
              >
                {wrongInfoStatus}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="character">
        {showWrongInfoButton &&
          !bubbleText.includes("I am the Festival Deli Assistant") && (
            <button className="wrong-info-button" onClick={openWrongInfoForm}>
              Wrong/missing info?
            </button>
          )}
        <img
          src={face}
          alt="Festival Deli Assistant"
          className={isFastBob ? "head fast-bob" : "head"}
        />
        <img
          src={isGesturing ? blakeBodyGesture : blakeBody}
          alt="Festival Deli Assistant Body"
          style={{ marginLeft: isGesturing ? "-14px" : "20px" }}
        />
        <img src={psBucket} alt="" className="ps-bucket" />
      </div>
      {isTyping && <div className="overlay"></div>}
      {!showManage && !showWrongInfoForm && (
        <div
          className={`input-area ${isTyping ? "typing" : ""}`}
          ref={inputAreaRef}
          style={
            isTyping && keyboardOffset > 0
              ? {
                  position: "fixed",
                  bottom: keyboardOffset,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: "95%",
                }
              : undefined
          }
        >
          <textarea
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsTyping(true)}
            rows={2}
          />
          <button onClick={handleSend}>Send</button>
        </div>
      )}
    </div>
  );
}

export default App;
