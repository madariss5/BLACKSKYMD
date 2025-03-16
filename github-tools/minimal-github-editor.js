/**
 * Minimal GitHub Editor
 * An extremely simple editor with minimal dependencies
 */

const https = require('https');
const readline = require('readline');

// Configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_INFO = process.env.GITHUB_REPOSITORY || 'madariss5/BLACKSKY';
const [OWNER, REPO] = REPO_INFO.split('/');

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Simple prompt function
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Make a GitHub API request
function githubRequest(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    console.log(`Making ${method} request to ${endpoint}...`);
    
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${OWNER}/${REPO}${endpoint}`,
      method: method,
      headers: {
        'User-Agent': 'Minimal-GitHub-Editor',
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      }
    };
    
    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));
    }
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsedData = responseData ? JSON.parse(responseData) : {};
            resolve(parsedData);
          } catch (e) {
            resolve(responseData);
          }
        } else {
          try {
            const errorData = JSON.parse(responseData);
            reject({
              statusCode: res.statusCode,
              message: errorData.message || 'Unknown error',
              errors: errorData.errors || []
            });
          } catch (e) {
            reject({
              statusCode: res.statusCode,
              message: responseData || 'Unknown error'
            });
          }
        }
      });
    });
    
    req.on('error', (error) => {
      reject({
        message: `Network error: ${error.message}`,
        originalError: error
      });
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Verify GitHub token
async function verifyToken() {
  try {
    console.log('Verifying GitHub token...');
    const response = await githubRequest('');
    console.log(`Token verification successful. Connected to ${response.name}`);
    return true;
  } catch (error) {
    console.error(`Token verification failed: ${error.message}`);
    return false;
  }
}

// Get file content
async function getFile(filePath) {
  try {
    console.log(`Fetching content for ${filePath}...`);
    const response = await githubRequest(`/contents/${filePath}`);
    const content = Buffer.from(response.content, 'base64').toString('utf8');
    console.log(`File retrieved successfully (${content.length} bytes)`);
    return {
      content,
      sha: response.sha,
      success: true
    };
  } catch (error) {
    console.error(`Error fetching file: ${error.message}`);
    
    if (error.statusCode === 404) {
      return { content: null, sha: null, success: false, error: 'File not found' };
    }
    
    return { content: null, sha: null, success: false, error: error.message };
  }
}

// Create or update a file
async function updateFile(filePath, content, message, sha = null) {
  try {
    console.log(`Preparing to update ${filePath}...`);
    
    const data = {
      message,
      content: Buffer.from(content).toString('base64'),
    };
    
    if (sha) {
      data.sha = sha;
    }
    
    const response = await githubRequest(`/contents/${filePath}`, 'PUT', data);
    console.log(`File updated successfully: ${filePath}`);
    return { success: true, response };
  } catch (error) {
    console.error(`Error updating file: ${error.message}`);
    
    if (error.errors && error.errors.length > 0) {
      for (const err of error.errors) {
        console.error(`- ${err.message}`);
      }
    }
    
    return { success: false, error: error.message };
  }
}

// List repository contents
async function listContents(path = '') {
  try {
    console.log(`Listing contents for /${path}...`);
    const contents = await githubRequest(`/contents/${path}`);
    
    // Sort by type and name
    return { success: true, contents: contents.sort((a, b) => {
      if (a.type === 'dir' && b.type !== 'dir') return -1;
      if (a.type !== 'dir' && b.type === 'dir') return 1;
      return a.name.localeCompare(b.name);
    })};
  } catch (error) {
    console.error(`Error listing contents: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Edit a file
async function editFile(filePath = null) {
  if (!filePath) {
    filePath = await prompt('Enter the file path to edit (e.g., src/index.js): ');
  }
  
  // Get current file content
  const { content, sha, success, error } = await getFile(filePath);
  
  if (!success) {
    console.error(`Cannot edit file: ${error}`);
    return { success: false, error };
  }
  
  console.log('\nCurrent content:');
  console.log('------------------------------');
  console.log(content);
  console.log('------------------------------\n');
  
  // Get new content
  console.log('Enter new content (type "--SAVE--" on a line by itself when done):');
  console.log('TIP: Copy-paste the content above, then modify as needed.');
  
  const lines = [];
  while (true) {
    const line = await prompt('');
    if (line === '--SAVE--') break;
    lines.push(line);
  }
  
  const newContent = lines.join('\n');
  
  // Check if content changed
  if (content === newContent) {
    console.log('No changes made to the file.');
    return { success: false, error: 'No changes' };
  }
  
  // Get commit message
  const commitMessage = await prompt('Enter commit message: ');
  
  // Update the file
  const result = await updateFile(filePath, newContent, commitMessage, sha);
  
  if (result.success) {
    console.log(`File updated successfully: ${filePath}`);
  }
  
  return result;
}

// Create a new file
async function createFile() {
  const filePath = await prompt('Enter the file path to create (e.g., src/newfile.js): ');
  
  // Check if file already exists
  const { success } = await getFile(filePath);
  
  if (success) {
    console.log(`File already exists: ${filePath}`);
    const editChoice = await prompt('Do you want to edit this file instead? (y/n): ');
    if (editChoice.toLowerCase() === 'y') {
      return await editFile(filePath);
    }
    return { success: false, error: 'File already exists' };
  }
  
  // Get content for the new file
  console.log('\nEnter content for the new file (type "--SAVE--" on a line by itself when done):');
  
  const lines = [];
  while (true) {
    const line = await prompt('');
    if (line === '--SAVE--') break;
    lines.push(line);
  }
  
  const content = lines.join('\n');
  
  // Get commit message
  const commitMessage = await prompt('Enter commit message: ');
  
  // Create the file
  const result = await updateFile(filePath, content, commitMessage);
  
  if (result.success) {
    console.log(`File created successfully: ${filePath}`);
  }
  
  return result;
}

// Browse repository
async function browseRepository() {
  let currentPath = '';
  
  while (true) {
    console.log(`\nCurrent location: /${currentPath}`);
    console.log('------------------------------');
    
    const result = await listContents(currentPath);
    
    if (!result.success) {
      console.log(`Cannot access /${currentPath}. Going back...`);
      if (currentPath.includes('/')) {
        currentPath = currentPath.split('/').slice(0, -1).join('/');
      } else {
        currentPath = '';
      }
      await prompt('Press Enter to continue...');
      continue;
    }
    
    const { contents } = result;
    
    if (contents.length === 0) {
      console.log('This directory is empty.');
    } else {
      // Display the contents
      console.log('\nContents:');
      contents.forEach((item, index) => {
        const itemType = item.type === 'dir' ? '[DIR]' : '[FILE]';
        console.log(`${index + 1}. ${itemType} ${item.name}`);
      });
    }
    
    console.log('\nCommands:');
    console.log('b - Go back to parent directory');
    console.log('h - Go to home (root) directory');
    console.log('q - Return to main menu');
    console.log('[number] - Select item by number');
    
    const choice = await prompt('\nEnter command: ');
    
    if (choice.toLowerCase() === 'q') {
      break;
    } else if (choice.toLowerCase() === 'b') {
      // Go to parent directory
      if (currentPath.includes('/')) {
        currentPath = currentPath.split('/').slice(0, -1).join('/');
      } else if (currentPath !== '') {
        currentPath = '';
      } else {
        console.log('Already at root directory.');
        await prompt('Press Enter to continue...');
      }
    } else if (choice.toLowerCase() === 'h') {
      // Go to home directory
      if (currentPath !== '') {
        currentPath = '';
      } else {
        console.log('Already at root directory.');
        await prompt('Press Enter to continue...');
      }
    } else {
      const index = parseInt(choice) - 1;
      if (!isNaN(index) && index >= 0 && index < contents.length) {
        const item = contents[index];
        if (item.type === 'dir') {
          currentPath = currentPath ? `${currentPath}/${item.name}` : item.name;
        } else {
          // View file
          const result = await getFile(`${currentPath ? currentPath + '/' : ''}${item.name}`);
          if (result.success) {
            console.log('\n------------------------------');
            console.log(`FILE: ${item.name}`);
            console.log('------------------------------');
            console.log(result.content);
            console.log('------------------------------\n');
            
            // Ask if user wants to edit the file
            const editChoice = await prompt('Do you want to edit this file? (y/n): ');
            if (editChoice.toLowerCase() === 'y') {
              await editFile(`${currentPath ? currentPath + '/' : ''}${item.name}`);
            }
          } else {
            console.log(`Could not view file: ${result.error}`);
          }
          await prompt('Press Enter to continue...');
        }
      } else {
        console.log('Invalid selection.');
        await prompt('Press Enter to continue...');
      }
    }
  }
}

// Main menu
async function mainMenu() {
  while (true) {
    console.log('\n===============================');
    console.log('  MINIMAL GITHUB EDITOR');
    console.log(`  Repository: ${OWNER}/${REPO}`);
    console.log('===============================\n');
    
    console.log('1. Browse repository');
    console.log('2. Edit a file');
    console.log('3. Create a new file');
    console.log('4. Verify GitHub token');
    console.log('0. Exit\n');
    
    const choice = await prompt('Enter your choice: ');
    
    switch (choice) {
      case '1':
        await browseRepository();
        break;
      case '2':
        await editFile();
        await prompt('Press Enter to continue...');
        break;
      case '3':
        await createFile();
        await prompt('Press Enter to continue...');
        break;
      case '4':
        await verifyToken();
        await prompt('Press Enter to continue...');
        break;
      case '0':
        console.log('Exiting Minimal GitHub Editor. Goodbye!');
        rl.close();
        return;
      default:
        console.log('Invalid choice. Please try again.');
        await prompt('Press Enter to continue...');
    }
  }
}

// Main function
async function main() {
  try {
    // Verify GitHub token
    const isTokenValid = await verifyToken();
    
    if (!isTokenValid) {
      console.log('GitHub token verification failed. Please check your token and permissions.');
      rl.close();
      return;
    }
    
    // Start the main menu
    await mainMenu();
  } catch (error) {
    console.log(`Unexpected error: ${error.message}`);
    console.error(error);
  } finally {
    // Make sure readline interface is closed
    rl.close();
  }
}

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  console.log('\nExiting Minimal GitHub Editor. Goodbye!');
  rl.close();
  process.exit(0);
});

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  rl.close();
});