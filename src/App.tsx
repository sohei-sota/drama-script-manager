import React, { useState, useEffect, useRef } from 'react';
import './App.css';

declare global {
  interface Window {
    electronAPI: {
      saveScript: (script: { english_text: string; japanese_text: string }) => Promise<number>;
      getAllScripts: () => Promise<Script[]>;
      searchScripts: (query: string) => Promise<Script[]>;
      deleteScript: (id: number) => Promise<number>;
      updateScript: (script: Omit<Script, 'title'>) => Promise<number>;
      exportScript: (script: { englishText: string; japaneseText: string }) => Promise<{ success: boolean; filePath?: string; cancelled?: boolean; error?: string }>;
      importScript: () => Promise<{ success: boolean; id?: number; englishText?: string; japaneseText?: string; cancelled?: boolean; error?: string }>;
    };
  }
}

interface Script {
  id: number;
  english_text: string;
  japanese_text: string;
}

// Helper function to truncate text
const truncateText = (text: string, maxLength: number = 150) => {
  if (!text) return '';
  const lines = text.split(/\r?\n/);
  let truncated = '';
  let currentLength = 0;
  for (const line of lines) {
    if (currentLength + line.length + 1 > maxLength) {
      truncated += line.substring(0, maxLength - currentLength) + '...';
      break;
    } else {
      truncated += line + '\n';
      currentLength += line.length + 1;
    }
  }
  return truncated.trim();
};

function App() {
  const [englishText, setEnglishText] = useState('');
  const [japaneseText, setJapaneseText] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
  const [scripts, setScripts] = useState<Script[]>([]);
  const [selectedScript, setSelectedScript] = useState<Script | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false); // New state for loading indicator
  const [isEditing, setIsEditing] = useState(false);
  const [editedEnglishText, setEditedEnglishText] = useState('');
  const [editedJapaneseText, setEditedJapaneseText] = useState('');

  const englishTextAreaRef = useRef<HTMLTextAreaElement>(null);
  const japaneseTextAreaRef = useRef<HTMLTextAreaElement>(null);

  // Refs for dynamic height textareas in display section
  const displayEnglishTextAreaRef = useRef<HTMLTextAreaElement>(null);
  const displayJapaneseTextAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchScripts();
  }, []);

  // Effect to clear messages after a few seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage('');
        setMessageType('');
      }, 5000); // Clear message after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      handleSearch();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  useEffect(() => {
    if (selectedScript) {
      setEditedEnglishText(selectedScript.english_text);
      setEditedJapaneseText(selectedScript.japanese_text);
      // Adjust height when selected script changes
      setTimeout(() => {
        adjustTextareaHeight(displayEnglishTextAreaRef.current);
        adjustTextareaHeight(displayJapaneseTextAreaRef.current);
      }, 0); // Timeout to ensure DOM is rendered
    }
  }, [selectedScript]);

  const fetchScripts = async () => {
    setIsLoading(true);
    try {
      const fetchedScripts = await window.electronAPI.getAllScripts();
      setScripts(fetchedScripts);
    } catch (error) {
      console.error('Failed to fetch scripts:', error);
      setMessage('スクリプトの読み込みに失敗しました。');
      setMessageType('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    setIsLoading(true);
    try {
      const searchedScripts = await window.electronAPI.searchScripts(searchTerm);
      setScripts(searchedScripts);
    } catch (error) {
      console.error('Failed to search scripts:', error);
      setMessage('スクリプトの検索に失敗しました。');
      setMessageType('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    setMessageType('');

    if (!englishText || !japaneseText) {
      setMessage('全てのフィールドを入力してください。');
      setMessageType('error');
      return;
    }

    setIsLoading(true);
    try {
      const newScriptId = await window.electronAPI.saveScript({
        english_text: englishText,
        japanese_text: japaneseText,
      });
      setMessage(`スクリプトが保存されました。ID: ${newScriptId}`);
      setMessageType('success');
      setEnglishText('');
      setJapaneseText('');
      fetchScripts();
    } catch (error) {
      setMessage(`スクリプトの保存に失敗しました: ${error}`);
      setMessageType('error');
      console.error('Failed to save script:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('本当にこのスクリプトを削除しますか？')) {
      setIsLoading(true);
      try {
        await window.electronAPI.deleteScript(id);
        setMessage('スクリプトが削除されました。');
        setMessageType('success');
        fetchScripts();
        if (selectedScript && selectedScript.id === id) {
          setSelectedScript(null);
        }
      } catch (error) {
        setMessage(`スクリプトの削除に失敗しました: ${error}`);
        setMessageType('error');
        console.error('Failed to delete script:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedScript) return;

    setMessage('');
    setMessageType('');
    if (!editedEnglishText || !editedJapaneseText) {
      setMessage('全てのフィールドを入力してください。');
      setMessageType('error');
      return;
    }

    setIsLoading(true);
    try {
      await window.electronAPI.updateScript({
        id: selectedScript.id,
        english_text: editedEnglishText,
        japanese_text: editedJapaneseText,
      });
      setMessage('スクリプトが更新されました。');
      setMessageType('success');
      setIsEditing(false);
      fetchScripts();
      setSelectedScript({
        ...selectedScript,
        english_text: editedEnglishText,
        japanese_text: editedJapaneseText,
      });
    } catch (error) {
      setMessage(`スクリプトの更新に失敗しました: ${error}`);
      setMessageType('error');
      console.error('Failed to update script:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    if (selectedScript) {
      setEditedEnglishText(selectedScript.english_text);
      setEditedJapaneseText(selectedScript.japanese_text);
    }
  };

  const handleExport = async () => {
    if (!selectedScript) {
      setMessage('エクスポートするスクリプトを選択してください。');
      setMessageType('error');
      return;
    }

    setIsLoading(true);
    try {
      const result = await window.electronAPI.exportScript({
        englishText: selectedScript.english_text,
        japaneseText: selectedScript.japanese_text,
      });

      if (result.success) {
        setMessage(`スクリプトがエクスポートされました: ${result.filePath}`);
        setMessageType('success');
      } else if (result.cancelled) {
        setMessage('エクスポートがキャンセルされました。');
        setMessageType(''); // No specific type for cancelled
      } else {
        setMessage(`エクスポートに失敗しました: ${result.error}`);
        setMessageType('error');
      }
    } catch (error) {
      setMessage(`エクスポートに失敗しました: ${error}`);
      setMessageType('error');
      console.error('Failed to export script:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    setMessage('');
    setMessageType('');
    setIsLoading(true);
    try {
      const result = await window.electronAPI.importScript();
      if (result.success) {
        setMessage(`スクリプトがインポートされました。`);
        setMessageType('success');
        fetchScripts(); // Refresh the script list
      } else if (result.cancelled) {
        setMessage('インポートがキャンセルされました。');
        setMessageType('');
      } else {
        setMessage(`インポートに失敗しました: ${result.error}`);
        setMessageType('error');
      }
    } catch (error) {
      setMessage(`インポートに失敗しました: ${error}`);
      setMessageType('error');
      console.error('Failed to import script:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to adjust textarea height
  const adjustTextareaHeight = (element: HTMLTextAreaElement | null) => {
    if (element) {
      element.style.height = 'auto'; // Reset height to recalculate
      element.style.height = element.scrollHeight + 'px';
    }
  };

  const handleScroll = (event: React.UIEvent<HTMLTextAreaElement>) => {
    const { currentTarget } = event;
    if (currentTarget === englishTextAreaRef.current && japaneseTextAreaRef.current) {
      japaneseTextAreaRef.current.scrollTop = currentTarget.scrollTop;
    } else if (currentTarget === japaneseTextAreaRef.current && englishTextAreaRef.current) {
      englishTextAreaRef.current.scrollTop = currentTarget.scrollTop;
    }
  };

  return (
    <div className="App">
      {isLoading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
        </div>
      )}
      <div className="content-wrapper">
        <div className="input-and-list-section">
          <h1>ドラマスクリプト入力</h1>
          <form onSubmit={handleSubmit}>
            {/* Title input removed */}
            <div className="input-text-group">
              <div>
                <label htmlFor="englishText">英語スクリプト:</label>
                <textarea
                  id="englishText"
                  value={englishText}
                  onChange={(e) => setEnglishText(e.target.value)}
                  rows={10}
                  required
                ></textarea>
              </div>
              <div>
                <label htmlFor="japaneseText">日本語スクリプト:</label>
                <textarea
                  id="japaneseText"
                  value={japaneseText}
                  onChange={(e) => setJapaneseText(e.target.value)}
                  rows={10}
                  required
                ></textarea>
              </div>
            </div>
            <button type="submit">スクリプトを保存</button>
          </form>
          <div className="message-area">
            {message && <p className={messageType}>{message}</p>}
          </div>

          <button onClick={handleImport} className="import-button" style={{ marginTop: '10px' }}>
            ファイルからインポート
          </button>

          <h2>保存済みスクリプト</h2>
          <div className="search-container">
            <input
              type="text"
              placeholder="スクリプトを検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {/* Search options removed as title search is gone */}
          </div>
          <ul className="script-list-cards">
            {scripts.map((script) => (
              <li key={script.id} className="script-card" onClick={() => setSelectedScript(script)}>
                <div className="card-content">
                  {/* Title removed from card */}
                  <p className="card-text-snippet english-snippet">{truncateText(script.english_text)}</p>
                  <p className="card-text-snippet japanese-snippet">{truncateText(script.japanese_text)}</p>
                  <div className="card-actions">
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(script.id); }} className="delete-button">
                      削除
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="selected-script-display-section">
          {selectedScript ? (
            <div>
              <div className="header-with-buttons">
                <h2>スクリプト詳細</h2> {/* Changed to generic title */}
                {!isEditing ? (
                  <div className="button-group">
                    <button onClick={handleEdit} className="edit-button">
                      編集
                    </button>
                    <button onClick={handleExport} className="export-button">
                      エクスポート
                    </button>
                  </div>
                ) : (
                  <div className="button-group">
                    <button onClick={handleSaveEdit} className="save-button">
                      保存
                    </button>
                    <button onClick={handleCancelEdit} className="cancel-button">
                      キャンセル
                    </button>
                  </div>
                )}
              </div>
              {/* Edited title input removed */}
              <div className="script-display-area">
                <div>
                  <h3>英語</h3>
                  <textarea
                    ref={displayEnglishTextAreaRef}
                    onInput={(e) => adjustTextareaHeight(e.currentTarget)}
                    onScroll={handleScroll}
                    value={isEditing ? editedEnglishText : selectedScript.english_text}
                    onChange={(e) => setEditedEnglishText(e.target.value)}
                    readOnly={!isEditing}
                  ></textarea>
                </div>
                <div>
                  <h3>日本語</h3>
                  <textarea
                    ref={displayJapaneseTextAreaRef}
                    onInput={(e) => adjustTextareaHeight(e.currentTarget)}
                    onScroll={handleScroll}
                    value={isEditing ? editedJapaneseText : selectedScript.japanese_text}
                    onChange={(e) => setEditedJapaneseText(e.target.value)}
                    readOnly={!isEditing}
                  ></textarea>
                </div>
              </div>
            </div>
          ) : (
            <p>スクリプトを選択してください。</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;