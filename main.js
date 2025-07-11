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

  ipcMain.handle('save-script', async (event, script) => {
    return new Promise((resolve, reject) => {
      db.run('INSERT INTO scripts (title, english_text, japanese_text) VALUES (?, ?, ?)', 
        [script.title, script.english_text, script.japanese_text], 
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
      db.all('SELECT id, title, english_text, japanese_text FROM scripts', [], (err, rows) => {
        if (err) {
          console.error('Error fetching scripts:', err.message);
          reject(err.message);
        } else {
          resolve(rows);
        }
      });
    });
  });

  ipcMain.handle('search-scripts', async (event, { query, searchBy }) => {
    return new Promise((resolve, reject) => {
      const searchTerm = `%${query}%`;
      let sql = 'SELECT id, title, english_text, japanese_text FROM scripts';
      let params = [];

      if (query) {
        if (searchBy === 'title') {
          sql += ' WHERE title LIKE ?';
          params = [searchTerm];
        } else { // searchBy === 'all' or undefined
          sql += ' WHERE title LIKE ? OR english_text LIKE ? OR japanese_text LIKE ?';
          params = [searchTerm, searchTerm, searchTerm];
        }
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

  ipcMain.handle('update-script', async (event, script) => {
    return new Promise((resolve, reject) => {
      db.run('UPDATE scripts SET title = ?, english_text = ?, japanese_text = ? WHERE id = ?', 
        [script.title, script.english_text, script.japanese_text, script.id], 
        function(err) {
          if (err) {
            console.error('Error updating script:', err.message);
            reject(err.message);
          } else {
            console.log(`A row has been updated with rowid ${script.id}`);
            resolve(this.changes);
          }
        }
      );
    });
  });

  ipcMain.handle('export-script', async (event, { title, englishText, japaneseText }) => {
    const { dialog } = require('electron');
    const fs = require('fs');

    try {
      const { filePath } = await dialog.showSaveDialog({
        title: 'スクリプトをエクスポート',
        defaultPath: `${title}.txt`,
        filters: [
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (filePath) {
        const content = `--- ${title} ---\n\n[English]\n${englishText}\n\n[Japanese]\n${japaneseText}`;
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

});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});