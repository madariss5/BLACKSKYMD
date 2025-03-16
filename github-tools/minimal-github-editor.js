/**
 * Minimal GitHub Web Editor
 * A simple, reliable web-based editor for GitHub files
 * Provides a clean interface for browsing and editing repository files
 */

const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Configuration
const app = express();
const port = process.env.GITHUB_EDITOR_PORT || 5002;
const githubToken = process.env.GITHUB_TOKEN;
const githubRepo = process.env.GITHUB_REPO || 'madariss5/BLACKSKY';
const githubBranch = process.env.GITHUB_BRANCH || 'main';

// Express configuration
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Create views directory if it doesn't exist
const viewsDir = path.join(__dirname, 'views');
if (!fs.existsSync(viewsDir)) {
  fs.mkdirSync(viewsDir, { recursive: true });
}

// Create EJS templates
const createEjsTemplates = () => {
  // Main layout template
  const layoutTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GitHub Editor - <%= title %></title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f6f8fa;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    header {
      background-color: #24292e;
      color: white;
      padding: 16px;
      margin-bottom: 20px;
    }
    h1, h2, h3 {
      margin-top: 0;
    }
    a {
      color: #0366d6;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    .breadcrumb {
      margin-bottom: 20px;
      padding: 10px;
      background-color: #fff;
      border: 1px solid #e1e4e8;
      border-radius: 6px;
    }
    .breadcrumb a {
      margin: 0 5px;
    }
    .file-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .file-list li {
      padding: 10px;
      border-bottom: 1px solid #e1e4e8;
      display: flex;
      align-items: center;
    }
    .file-list li:last-child {
      border-bottom: none;
    }
    .file-list li:hover {
      background-color: #f1f1f1;
    }
    .file-list .folder {
      color: #0366d6;
      font-weight: bold;
    }
    .file-list .file {
      color: #24292e;
    }
    .icon {
      margin-right: 10px;
      display: inline-block;
      width: 20px;
      text-align: center;
    }
    .editor-container {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 200px);
      min-height: 400px;
    }
    .editor {
      width: 100%;
      height: 100%;
      font-family: monospace;
      font-size: 14px;
      padding: 10px;
      border: 1px solid #e1e4e8;
      border-radius: 6px;
      resize: vertical;
    }
    .editor-actions {
      margin-top: 10px;
      display: flex;
      justify-content: space-between;
    }
    .btn {
      display: inline-block;
      padding: 8px 16px;
      font-size: 14px;
      font-weight: 500;
      line-height: 20px;
      text-align: center;
      white-space: nowrap;
      vertical-align: middle;
      cursor: pointer;
      user-select: none;
      border: 1px solid transparent;
      border-radius: 6px;
      margin-right: 8px;
    }
    .btn-primary {
      color: #fff;
      background-color: #2ea44f;
      border-color: #2a9147;
    }
    .btn-secondary {
      color: #24292e;
      background-color: #fafbfc;
      border-color: #e1e4e8;
    }
    .btn-primary:hover {
      background-color: #2c974b;
      border-color: #278c44;
    }
    .btn-secondary:hover {
      background-color: #f3f4f6;
      border-color: #d9dadc;
    }
    .message {
      padding: 10px;
      margin: 10px 0;
      border-radius: 6px;
    }
    .success {
      background-color: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }
    .error {
      background-color: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }
    .info {
      background-color: #d1ecf1;
      color: #0c5460;
      border: 1px solid #bee5eb;
    }
    .create-form {
      margin-top: 20px;
      padding: 15px;
      background: #fff;
      border: 1px solid #e1e4e8;
      border-radius: 6px;
    }
    .form-group {
      margin-bottom: 15px;
    }
    .form-group label {
      display: block;
      margin-bottom: 5px;
      font-weight: bold;
    }
    .form-control {
      width: 100%;
      padding: 8px;
      font-size: 14px;
      border: 1px solid #e1e4e8;
      border-radius: 6px;
    }
  </style>
</head>
<body>
  <header>
    <div class="container">
      <h1>GitHub File Editor</h1>
      <div>Repository: <%= repo %> | Branch: <%= branch %></div>
    </div>
  </header>
  
  <div class="container">
    <% if (typeof message !== 'undefined' && message) { %>
      <div class="message <%= messageType %>">
        <%= message %>
      </div>
    <% } %>
    
    <%- body %>
  </div>
</body>
</html>`;

  // Index/Browse view template
  const indexTemplate = `<% if (path !== '') { %>
  <div class="breadcrumb">
    <a href="/">Root</a>
    <% 
      let parts = path.split('/');
      let currentPath = '';
      parts.forEach((part, index) => {
        if (part) {
          currentPath += '/' + part;
          if (index < parts.length - 1) { %>
            / <a href="/browse<%= currentPath %>"><%= part %></a>
          <% } else { %>
            / <span><%= part %></span>
          <% }
        }
      });
    %>
  </div>
<% } %>

<h2>Files and Directories</h2>

<ul class="file-list">
  <% if (path !== '') { %>
    <li>
      <span class="icon">⬆️</span>
      <a href="/browse<%= path.split('/').slice(0, -1).join('/') %>" class="folder">.. (Parent Directory)</a>
    </li>
  <% } %>
  
  <% contents.forEach(item => { %>
    <li>
      <% if (item.type === 'dir') { %>
        <span class="icon">📁</span>
        <a href="/browse<%= path + '/' + item.name %>" class="folder"><%= item.name %></a>
      <% } else { %>
        <span class="icon">📄</span>
        <a href="/edit<%= path + '/' + item.name %>" class="file"><%= item.name %></a>
      <% } %>
    </li>
  <% }); %>
</ul>

<div class="create-form">
  <h3>Create New File</h3>
  <form action="/create" method="post">
    <input type="hidden" name="directory" value="<%= path %>">
    
    <div class="form-group">
      <label for="filename">File Name:</label>
      <input type="text" id="filename" name="filename" class="form-control" required>
    </div>
    
    <button type="submit" class="btn btn-primary">Create New File</button>
  </form>
</div>`;

  // Edit view template
  const editTemplate = `<div class="breadcrumb">
  <a href="/">Root</a>
  <% 
    let parts = path.split('/');
    let currentPath = '';
    parts.forEach((part, index) => {
      if (part) {
        currentPath += '/' + part;
        if (index < parts.length - 1) { %>
          / <a href="/browse<%= currentPath %>"><%= part %></a>
        <% } else { %>
          / <span><%= part %></span>
        <% }
      }
    });
  %>
</div>

<h2>Editing: <%= path %></h2>

<form action="/save" method="post">
  <input type="hidden" name="path" value="<%= path %>">
  <input type="hidden" name="sha" value="<%= sha %>">
  
  <div class="editor-container">
    <textarea name="content" class="editor"><%= content %></textarea>
  </div>
  
  <div class="editor-actions">
    <div>
      <button type="submit" class="btn btn-primary">Save Changes</button>
      <a href="/browse<%= path.split('/').slice(0, -1).join('/') %>" class="btn btn-secondary">Cancel</a>
    </div>
    
    <div>
      <input type="text" name="commitMessage" class="form-control" placeholder="Commit message" value="Update <%= path.split('/').pop() %>" required>
    </div>
  </div>
</form>`;

  // Create view template
  const createTemplate = `<div class="breadcrumb">
  <a href="/">Root</a>
  <% 
    let parts = directory.split('/');
    let currentPath = '';
    parts.forEach((part, index) => {
      if (part) {
        currentPath += '/' + part;
        if (index < parts.length - 1) { %>
          / <a href="/browse<%= currentPath %>"><%= part %></a>
        <% } else { %>
          / <span><%= part %></span>
        <% }
      }
    });
  %>
</div>

<h2>Create new file in: <%= directory %></h2>

<form action="/save" method="post">
  <input type="hidden" name="path" value="<%= directory + '/' + filename %>">
  
  <div class="form-group">
    <label>File name: <%= filename %></label>
  </div>
  
  <div class="editor-container">
    <textarea name="content" class="editor"></textarea>
  </div>
  
  <div class="editor-actions">
    <div>
      <button type="submit" class="btn btn-primary">Create File</button>
      <a href="/browse<%= directory %>" class="btn btn-secondary">Cancel</a>
    </div>
    
    <div>
      <input type="text" name="commitMessage" class="form-control" placeholder="Commit message" value="Create <%= filename %>" required>
    </div>
  </div>
</form>`;

  // Write templates to files
  fs.writeFileSync(path.join(viewsDir, 'layout.ejs'), layoutTemplate);
  fs.writeFileSync(path.join(viewsDir, 'index.ejs'), indexTemplate);
  fs.writeFileSync(path.join(viewsDir, 'edit.ejs'), editTemplate);
  fs.writeFileSync(path.join(viewsDir, 'create.ejs'), createTemplate);
};

// Create the templates
createEjsTemplates();

// Helper function to render with the layout
const renderWithLayout = (res, view, data) => {
  res.render(view, {
    ...data,
    layout: 'layout',
    repo: githubRepo,
    branch: githubBranch
  });
};

// GitHub API functions
const github = {
  // Base headers for all requests
  headers: {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github.v3+json'
  },
  
  // Get contents of a directory or file
  async getContents(path = '') {
    try {
      const response = await axios.get(
        `https://api.github.com/repos/${githubRepo}/contents/${path}?ref=${githubBranch}`,
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error getting contents:', error.message);
      throw new Error(`Failed to get contents: ${error.message}`);
    }
  },
  
  // Save/update a file
  async saveFile(path, content, message, sha = undefined) {
    try {
      const data = {
        message,
        content: Buffer.from(content).toString('base64'),
        branch: githubBranch
      };
      
      if (sha) {
        data.sha = sha;
      }
      
      const response = await axios.put(
        `https://api.github.com/repos/${githubRepo}/contents/${path}`,
        data,
        { headers: this.headers }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error saving file:', error.message);
      throw new Error(`Failed to save file: ${error.message}`);
    }
  },
  
  // Test auth token
  async testAuth() {
    try {
      const response = await axios.get(
        `https://api.github.com/repos/${githubRepo}`,
        { headers: this.headers }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.message, 
        status: error.response?.status,
        data: error.response?.data
      };
    }
  }
};

// Routes

// Home/root directory
app.get('/', async (req, res) => {
  try {
    const contents = await github.getContents('');
    const dirContents = Array.isArray(contents) ? contents : [];
    
    renderWithLayout(res, 'index', {
      title: 'Browse Repository',
      path: '',
      contents: dirContents.map(item => ({
        name: item.name,
        type: item.type,
        sha: item.sha
      }))
    });
  } catch (error) {
    renderWithLayout(res, 'index', {
      title: 'Error',
      path: '',
      contents: [],
      message: `Error fetching repository contents: ${error.message}`,
      messageType: 'error'
    });
  }
});

// Browse directory
app.get('/browse/*', async (req, res) => {
  const path = req.params[0] || '';
  
  try {
    const contents = await github.getContents(path);
    
    // If it's a file, redirect to the edit page
    if (!Array.isArray(contents)) {
      return res.redirect(`/edit/${path}`);
    }
    
    renderWithLayout(res, 'index', {
      title: `Browse: ${path}`,
      path,
      contents: contents.map(item => ({
        name: item.name,
        type: item.type,
        sha: item.sha
      }))
    });
  } catch (error) {
    renderWithLayout(res, 'index', {
      title: 'Error',
      path,
      contents: [],
      message: `Error fetching directory contents: ${error.message}`,
      messageType: 'error'
    });
  }
});

// Edit file
app.get('/edit/*', async (req, res) => {
  const path = req.params[0] || '';
  
  try {
    const file = await github.getContents(path);
    
    // If it's a directory, redirect to the browse page
    if (Array.isArray(file)) {
      return res.redirect(`/browse/${path}`);
    }
    
    const content = Buffer.from(file.content, 'base64').toString('utf8');
    
    renderWithLayout(res, 'edit', {
      title: `Edit: ${path}`,
      path,
      content,
      sha: file.sha
    });
  } catch (error) {
    renderWithLayout(res, 'index', {
      title: 'Error',
      path: '',
      contents: [],
      message: `Error fetching file content: ${error.message}`,
      messageType: 'error'
    });
  }
});

// Create new file form
app.post('/create', (req, res) => {
  const { directory, filename } = req.body;
  
  if (!filename) {
    return res.redirect(`/browse/${directory || ''}`);
  }
  
  renderWithLayout(res, 'create', {
    title: 'Create New File',
    directory: directory || '',
    filename
  });
});

// Save/update file
app.post('/save', async (req, res) => {
  const { path, content, commitMessage, sha } = req.body;
  
  try {
    await github.saveFile(path, content, commitMessage, sha);
    
    // Redirect to the directory containing the file
    const directory = path.split('/').slice(0, -1).join('/');
    res.redirect(`/browse/${directory}`);
  } catch (error) {
    renderWithLayout(res, 'index', {
      title: 'Error',
      path: '',
      contents: [],
      message: `Error saving file: ${error.message}`,
      messageType: 'error'
    });
  }
});

// Verify GitHub token
app.get('/verify-token', async (req, res) => {
  try {
    const result = await github.testAuth();
    
    if (result.success) {
      renderWithLayout(res, 'index', {
        title: 'Token Verification',
        path: '',
        contents: [],
        message: 'GitHub token is valid and working properly.',
        messageType: 'success'
      });
    } else {
      renderWithLayout(res, 'index', {
        title: 'Token Verification Failed',
        path: '',
        contents: [],
        message: `GitHub token verification failed: ${result.error}. Status: ${result.status}`,
        messageType: 'error'
      });
    }
  } catch (error) {
    renderWithLayout(res, 'index', {
      title: 'Token Verification Error',
      path: '',
      contents: [],
      message: `Error verifying token: ${error.message}`,
      messageType: 'error'
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`GitHub Web Editor running at http://localhost:${port}`);
  console.log(`Repository: ${githubRepo}, Branch: ${githubBranch}`);
  
  // Check if GitHub token exists
  if (!githubToken) {
    console.error('\x1b[31m%s\x1b[0m', 'ERROR: GitHub token is not set!');
    console.error('Please set the GITHUB_TOKEN environment variable with a valid token.');
  } else {
    console.log('GitHub token is configured.');
  }
});