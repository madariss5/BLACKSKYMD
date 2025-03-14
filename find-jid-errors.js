/**
 * JID Error Detection Script
 * This script identifies potential files that may encounter "jid.endsWith is not a function" errors
 * by looking for direct sock.sendMessage calls without proper JID handling
 */

const fs = require('fs').promises;
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

// Logger for the script
const logger = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  warn: (msg) => console.log(`[WARNING] ${msg}`),
  error: (msg, err) => console.error(`[ERROR] ${msg}`, err || '')
};

// Command directories to scan
const COMMAND_DIRS = [
  './src/commands',
  './src/handlers'
];

// Patterns to search for potential JID handling issues
const PATTERNS = {
  SEND_MESSAGE: /sock\.sendMessage\s*\(\s*([^,\)]+)\s*,/g,
  SAFE_JID_USAGE: /safeSend(?:Message|Text|Image|Sticker)/g,
  NORMALIZE_JID: /normalizeJid\s*\(/g,
  JID_CHECK: /isJid(?:Group|User)/g,
  JID_ENDSWITH: /\.endsWith\s*\(\s*['"]@[gs]\./g
};

// Helper to safely get file content
async function getFileContent(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (err) {
    logger.error(`Failed to read file: ${filePath}`, err);
    return null;
  }
}

// Helper to scan a directory recursively
async function scanDirectory(dir) {
  let files = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        const subFiles = await scanDirectory(fullPath);
        files = files.concat(subFiles);
      } else if (entry.name.endsWith('.js')) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    logger.error(`Failed to scan directory: ${dir}`, err);
  }
  
  return files;
}

// Analyze a file for potential JID handling issues
async function analyzeFile(filePath) {
  const content = await getFileContent(filePath);
  if (!content) return null;
  
  // Count the occurrences of each pattern
  const counts = {
    sendMessage: (content.match(PATTERNS.SEND_MESSAGE) || []).length,
    safeJidUsage: (content.match(PATTERNS.SAFE_JID_USAGE) || []).length,
    normalizeJid: (content.match(PATTERNS.NORMALIZE_JID) || []).length,
    jidCheck: (content.match(PATTERNS.JID_CHECK) || []).length,
    jidEndswith: (content.match(PATTERNS.JID_ENDSWITH) || []).length
  };
  
  // Calculate risk score: higher means more risk of JID errors
  const riskScore = counts.sendMessage - 
                   (counts.safeJidUsage * 2) - 
                   (counts.normalizeJid * 1.5) -
                   (counts.jidCheck * 1) -
                   (counts.jidEndswith * 0.5);
  
  return {
    file: filePath,
    counts,
    riskScore: riskScore > 0 ? riskScore : 0
  };
}

// Find potential files with JID handling issues
async function findPotentialJidErrors() {
  logger.info('Starting JID error detection script...');
  
  // Get all JS files from the command directories
  let jsFiles = [];
  for (const dir of COMMAND_DIRS) {
    logger.info(`Scanning directory: ${dir}`);
    const files = await scanDirectory(dir);
    jsFiles = jsFiles.concat(files);
  }
  
  logger.info(`Found ${jsFiles.length} JavaScript files to analyze`);
  
  // Analyze each file
  const fileAnalyses = [];
  for (const file of jsFiles) {
    const analysis = await analyzeFile(file);
    if (analysis && analysis.riskScore > 0) {
      fileAnalyses.push(analysis);
    }
  }
  
  // Sort by risk score (highest first)
  fileAnalyses.sort((a, b) => b.riskScore - a.riskScore);
  
  // Generate report
  logger.info('\n======= JID Error Risk Report =======');
  logger.info(`Found ${fileAnalyses.length} files with potential JID handling issues.`);
  
  if (fileAnalyses.length > 0) {
    logger.info('\nTop 20 files with highest risk:');
    fileAnalyses.slice(0, 20).forEach((analysis, index) => {
      logger.info(`${index + 1}. ${analysis.file}`);
      logger.info(`   Risk Score: ${analysis.riskScore.toFixed(2)}`);
      logger.info(`   sendMessage calls: ${analysis.counts.sendMessage}`);
      logger.info(`   Safe JID usage: ${analysis.counts.safeJidUsage}`);
      logger.info('   ---');
    });
    
    // Generate an easy copy-paste list for the top riskiest files
    logger.info('\nQuick fix list (highest risk files):');
    fileAnalyses.slice(0, 10).forEach(analysis => {
      logger.info(`node fix-jid-handling.js "${analysis.file}"`);
    });
  }
  
  return fileAnalyses;
}

// Execute the analysis
findPotentialJidErrors()
  .then(fileAnalyses => {
    console.log(`\nAnalysis complete. Found ${fileAnalyses.length} files with potential JID issues.`);
    process.exit(0);
  })
  .catch(err => {
    console.error('Script execution failed:', err);
    process.exit(1);
  });