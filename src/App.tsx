import React, { useState, useEffect, useRef } from 'react';
import './App.css';

declare global {
  interface Window {
    electronAPI: {
      saveScript: (script: { title: string; english_text: string; japanese_text: string }) => Promise<number>;
      getAllScripts: () => Promise<Script[]>;
      searchScripts: (query: string, searchBy: 'all' | 'title') => Promise<Script[]>;
      deleteScript: (id: number) => Promise<number>;
      updateScript: (script: Script) => Promise<number>;
      exportScript: (script: { title: string; englishText: string; japaneseText: string }) => Promise<{ success: boolean; filePath?: string; cancelled?: boolean; error?: string }>;
    };
  }
}

interface Script {
  id: number;
  title: string;
  english_text: string;
  japanese_text: string;
}

function App() {
  const [title, setTitle] = useState('');
  const [englishText, setEnglishText] = useState('');
  const [japaneseText, setJapaneseText] = useState('');
  const [message, setMessage] = useState('');
  const [scripts, setScripts] = useState<Script[]>([]);
  const [selectedScript, setSelectedScript] = useState<Script | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchBy, setSearchBy] = useState<'all' | 'title'>('all'); // New state for search scope
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedEnglishText, setEditedEnglishText] = useState('');
  const [editedJapaneseText, setEditedJapaneseText] = useState('');

  const englishTextAreaRef = useRef<HTMLTextAreaElement>(null);
  const japaneseTextAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchScripts();
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      handleSearch();
    }, 300); // 300ms delay for debouncing

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, searchBy]); // Re-run search when searchBy changes

  useEffect(() => {
    if (selectedScript) {
      setEditedTitle(selectedScript.title);
      setEditedEnglishText(selectedScript.english_text);
      setEditedJapaneseText(selectedScript.japanese_text);
    }
  }, [selectedScript]);

  const fetchScripts = async () => {
    try {
      const fetchedScripts = await window.electronAPI.getAllScripts();
      setScripts(fetchedScripts);
    } catch (error) {
      console.error('Failed to fetch scripts:', error);
    }
  };

  const handleSearch = async () => {
    if (searchTerm.trim() === '') {
      fetchScripts(); // If search term is empty, show all scripts
      return;
    }
    try {
      const searchedScripts = await window.electronAPI.searchScripts(searchTerm, searchBy);
      setScripts(searchedScripts);
    } catch (error) {
      console.error('Failed to search scripts:', error);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');

    if (!title || !englishText || !japaneseText) {
      setMessage('全てのフィールドを入力してください。');
      return;
    }

    try {
      const newScriptId = await window.electronAPI.saveScript({
        title,
        english_text: englishText,
        japanese_text: japaneseText,
      });
      setMessage(`スクリプトが保存されました。ID: ${newScriptId}`);
      setTitle('');
      setEnglishText('');
      setJapaneseText('');
      fetchScripts(); // Refresh the script list
    } catch (error) {
      setMessage(`スクリプトの保存に失敗しました: ${error}`);
      console.error('Failed to save script:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('本当にこのスクリプトを削除しますか？')) {
      try {
        await window.electronAPI.deleteScript(id);
        setMessage('スクリプトが削除されました。');
        fetchScripts(); // Refresh the script list
        if (selectedScript && selectedScript.id === id) {
          setSelectedScript(null); // Deselect if the deleted script was selected
        }
      } catch (error) {
        setMessage(`スクリプトの削除に失敗しました: ${error}`);
        console.error('Failed to delete script:', error);
      }
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedScript) return;

    setMessage('');
    if (!editedTitle || !editedEnglishText || !editedJapaneseText) {
      setMessage('全てのフィールドを入力してください。');
      return;
    }

    try {
      await window.electronAPI.updateScript({
        id: selectedScript.id,
        title: editedTitle,
        english_text: editedEnglishText,
        japanese_text: editedJapaneseText,
      });
      setMessage('スクリプトが更新されました。');
      setIsEditing(false);
      fetchScripts(); // Refresh the script list
      // Update selectedScript state to reflect changes immediately
      setSelectedScript({
        ...selectedScript,
        title: editedTitle,
        english_text: editedEnglishText,
        japanese_text: editedJapaneseText,
      });
    } catch (error) {
      setMessage(`スクリプトの更新に失敗しました: ${error}`);
      console.error('Failed to update script:', error);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    if (selectedScript) {
      setEditedTitle(selectedScript.title);
      setEditedEnglishText(selectedScript.english_text);
      setEditedJapaneseText(selectedScript.japanese_text);
    }
  };

  const handleExport = async () => {
    if (!selectedScript) {
      setMessage('エクスポートするスクリプトを選択してください。');
      return;
    }

    try {
      const result = await window.electronAPI.exportScript({
        title: selectedScript.title,
        englishText: selectedScript.english_text,
        japaneseText: selectedScript.japanese_text,
      });

      if (result.success) {
        setMessage(`スクリプトがエクスポートされました: ${result.filePath}`);
      } else if (result.cancelled) {
        setMessage('エクスポートがキャンセルされました。');
      } else {
        setMessage(`エクスポートに失敗しました: ${result.error}`);
      }
    } catch (error) {
      setMessage(`エクスポートに失敗しました: ${error}`);
      console.error('Failed to export script:', error);
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
      <div style={{ display: 'flex' }}>
        <div style={{ flex: 1, padding: '20px', borderRight: '1px solid #ccc' }}>
          <h1>ドラマスクリプト入力</h1>
          <form onSubmit={handleSubmit}>
            <div>
              <label htmlFor="title">タイトル:</label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
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
            <button type="submit">スクリプトを保存</button>
          </form>
          {message && <p>{message}</p>}

          <h2>保存済みスクリプト</h2>
          <div>
            <input
              type="text"
              placeholder="スクリプトを検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: 'calc(100% - 20px)', marginBottom: '10px' }}
            />
            <div style={{ marginBottom: '10px' }}>
              <label>
                <input
                  type="radio"
                  value="all"
                  checked={searchBy === 'all'}
                  onChange={() => setSearchBy('all')}
                />
                すべて
              </label>
              <label style={{ marginLeft: '10px' }}>
                <input
                  type="radio"
                  value="title"
                  checked={searchBy === 'title'}
                  onChange={() => setSearchBy('title')}
                />
                タイトルのみ
              </label>
            </div>
          </div>
          <ul>
            {scripts.map((script) => (
              <li key={script.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span onClick={() => setSelectedScript(script)} style={{ cursor: 'pointer', flexGrow: 1 }}>
                  {script.title}
                </span>
                <button onClick={() => handleDelete(script.id)} style={{ marginLeft: '10px', padding: '5px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>
                  削除
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ flex: 2, padding: '20px' }}>
          {selectedScript ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>{isEditing ? 'スクリプトを編集' : selectedScript.title}</h2>
                {!isEditing ? (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={handleEdit} style={{ padding: '5px 10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>
                      編集
                    </button>
                    <button onClick={handleExport} style={{ padding: '5px 10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>
                      エクスポート
                    </button>
                  </div>
                ) : (
                  <div>
                    <button onClick={handleSaveEdit} style={{ padding: '5px 10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', marginRight: '5px' }}>
                      保存
                    </button>
                    <button onClick={handleCancelEdit} style={{ padding: '5px 10px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>
                      キャンセル
                    </button>
                  </div>
                )}
              </div>
              {isEditing && (
                <div style={{ marginBottom: '10px' }}>
                  <label htmlFor="editedTitle">タイトル:</label>
                  <input
                    id="editedTitle"
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
              )}
              <div style={{ display: 'flex' }}>
                <div style={{ flex: 1, marginRight: '10px' }}>
                  <h3>英語</h3>
                  <textarea
                    ref={englishTextAreaRef}
                    onScroll={handleScroll}
                    value={isEditing ? editedEnglishText : selectedScript.english_text}
                    onChange={(e) => setEditedEnglishText(e.target.value)}
                    readOnly={!isEditing}
                    rows={20}
                    style={{ width: '100%' }}
                  ></textarea>
                </div>
                <div style={{ flex: 1 }}>
                  <h3>日本語</h3>
                  <textarea
                    ref={japaneseTextAreaRef}
                    onScroll={handleScroll}
                    value={isEditing ? editedJapaneseText : selectedScript.japanese_text}
                    onChange={(e) => setEditedJapaneseText(e.target.value)}
                    readOnly={!isEditing}
                    rows={20}
                    style={{ width: '100%' }}
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
