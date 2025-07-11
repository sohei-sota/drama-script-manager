const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const db = require('./database'); // Import the database module

const isDev = process.env.NODE_ENV === 'development';

function createWindow () {
  const preloadPath = path.join(__dirname, 'electron-preload.js');
  console.log('Main process __dirname:', __dirname);
  console.log('Main process preload path:', preloadPath);

  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  if (isDev) {
    win.loadURL('http://localhost:3000'); // React development server
    win.webContents.openDevTools(); // Open DevTools in development mode
  } else {
    win.loadFile(path.join(__dirname, 'build', 'index.html')); // Load built React app
  }
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle('save-script', async (event, { english_text, japanese_text }) => {
    return new Promise((resolve, reject) => {
      db.run('INSERT INTO scripts (english_text, japanese_text) VALUES (?, ?)', 
        [english_text, japanese_text], 
        function(err) {
          if (err) {
            console.error('Error inserting script:', err.message);
            reject(err.message);
          } else {
            console.log(`A row has been inserted with rowid ${this.lastID}`);
            resolve(this.lastID);
          }
        }
      );
    });
  });

  ipcMain.handle('get-all-scripts', async () => {
    return new Promise((resolve, reject) => {
      db.all('SELECT id, english_text, japanese_text FROM scripts', [], (err, rows) => {
        if (err) {
          console.error('Error fetching scripts:', err.message);
          reject(err.message);
        } else {
          resolve(rows);
        }
      });
    });
  });

  ipcMain.handle('search-scripts', async (event, { query }) => {
    return new Promise((resolve, reject) => {
      const searchTerm = `%${query}%`;
      let sql = 'SELECT id, english_text, japanese_text FROM scripts';
      let params = [];

      if (query) {
        sql += ' WHERE english_text LIKE ? OR japanese_text LIKE ?';
        params = [searchTerm, searchTerm];
      }

      db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('Error searching scripts:', err.message);
          reject(err.message);
        } else {
          resolve(rows);
        }
      });
    });
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  ipcMain.handle('delete-script', async (event, id) => {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM scripts WHERE id = ?', id, function(err) {
        if (err) {
          console.error('Error deleting script:', err.message);
          reject(err.message);
        } else {
          console.log(`A row has been deleted with rowid ${id}`);
          resolve(this.changes);
        }
      });
    });
  });

  ipcMain.handle('update-script', async (event, { id, english_text, japanese_text }) => {
    return new Promise((resolve, reject) => {
      db.run('UPDATE scripts SET english_text = ?, japanese_text = ? WHERE id = ?', 
        [english_text, japanese_text, id], 
        function(err) {
          if (err) {
            console.error('Error updating script:', err.message);
            reject(err.message);
          } else {
            console.log(`A row has been updated with rowid ${id}`);
            resolve(this.changes);
          }
        }
      );
    });
  });

  ipcMain.handle('export-script', async (event, { englishText, japaneseText }) => {
    const { dialog } = require('electron');
    const fs = require('fs');

    try {
      const { filePath } = await dialog.showSaveDialog({
        title: 'スクリプトをエクスポート',
        defaultPath: 'script.txt',
        filters: [
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (filePath) {
        const content = `[English]\n${englishText}\n\n[Japanese]\n${japaneseText}`;
        fs.writeFileSync(filePath, content);
        return { success: true, filePath };
      } else {
        return { success: false, cancelled: true };
      }
    } catch (error) {
      console.error('Error exporting script:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('import-script', async (event) => {
    const { dialog } = require('electron');
    const fs = require('fs');

    try {
      const { filePaths: englishFilePaths } = await dialog.showOpenDialog({
        title: '英語スクリプトファイルを選択',
        properties: ['openFile'],
        filters: [
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (!englishFilePaths || englishFilePaths.length === 0) {
        return { success: false, cancelled: true };
      }

      const { filePaths: japaneseFilePaths } = await dialog.showOpenDialog({
        title: '日本語スクリプトファイルを選択',
        properties: ['openFile'],
        filters: [
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (!japaneseFilePaths || japaneseFilePaths.length === 0) {
        return { success: false, cancelled: true };
      }

      const englishText = fs.readFileSync(englishFilePaths[0], 'utf8');
      const japaneseText = fs.readFileSync(japaneseFilePaths[0], 'utf8');

      return new Promise((resolve, reject) => {
        db.run('INSERT INTO scripts (english_text, japanese_text) VALUES (?, ?)', 
          [englishText, japaneseText], 
          function(err) {
            if (err) {
              console.error('Error importing script:', err.message);
              reject({ success: false, error: err.message });
            } else {
              console.log(`A row has been inserted with rowid ${this.lastID}`);
              resolve({ success: true, id: this.lastID, englishText, japaneseText });
            }
          }
        );
      });

    } catch (error) {
      console.error('Error during import process:', error);
      return { success: false, error: error.message };
    }
  });

});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});